# Users module + CQRS for cross-module communication

## Context

JWT authentication in the repository is **already implemented and working**: `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/auth/me`, `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser()`,
argon2 hashing, the `User` model. The scaffold ran ahead of the course step.

What is missing and needs doing:

1. **There is no user layer** — `AuthService` injects `PrismaService` directly.
   We need `UsersRepository` (data access) and `UsersService` (business rules).
2. **No account management endpoints** — profile, password change, deletion.
3. **The field is called `password` even though it stores a hash** — rename it to `passwordHash`.
4. **Cross-module communication goes through CQRS** (`@nestjs/cqrs@11.0.3`): `AuthModule`
   no longer imports `UsersModule` and no longer injects `UsersService` — only the buses.

The result: `AuthModule` knows nothing about Prisma or `UsersService`; the single entry point
into the users module is commands and queries. The public API contract does not break,
and the frontend keeps working unchanged.

## Key decisions (and why)

**Handlers are transport adapters; domain logic lives in `UsersService`.** A handler
unwraps the message and calls a service method. This makes the logic unit-testable
without the bus, and `UsersService` does not degenerate into a pass-through: it holds argon2,
the email conflict checks and the mapping to `UserDto`, all shared across several handlers.

**`UsersModule` does NOT export `UsersService`.** That is the point of the exercise. Verified:
`AuthService` is not injected into any other module, and `JwtAuthGuard`/`@CurrentUser()`
are imported by file path (see `apps/backend/src/expenses/expenses.controller.ts:17`), so
forbidding the export breaks nothing.

**`CqrsModule.forRoot()` in `AppModule`.** Verified against the 11.0.3 sources: `forRoot()`
returns a module with `global: true`, the bare `CqrsModule` does not. Mixing the two forms
yields an opaque `Nest can't resolve CommandBus` at startup. Global registration is
consistent with the already-global `PrismaModule` and `ConfigModule`.

**Plaintext passwords travel over the bus — accepted deliberately.** `CommandBus.execute` and
`QueryBus.execute` call `publisher.publish(message)` for every message. Passwords are carried by
`RegisterUserCommand`, `ChangeUserPasswordCommand`, `DeleteUserCommand` and
`VerifyUserCredentialsQuery` — working around it case by case is pointless. Each such class
gets a warning comment: if a logging publisher is ever added, these fields
must be redacted.

**`GetUserByIdQuery` returns `UserDto | null` rather than throwing `NotFoundException`.**
`/auth/me` must answer **401** for a token naming a nonexistent user: the frontend logs out
on 401 and on nothing else (`ApiError.isUnauthorized`, `apps/frontend/src/lib/api-client.ts:14`).
The calling module picks the HTTP semantics, not the handler.

**`VerifyUserCredentialsQuery` is a query, and rightly so.** It has no side effects: an argon2
comparison and a return. It resolves to `UserDto | null`; `UnauthorizedException("Invalid email or password")`
is thrown by `AuthService`, because it owns the endpoint.

**No events (EventBus), no `lastLoginAt`.** Events without subscribers are dead code;
writing `lastLoginAt` on login would be a side effect inside a query, which breaks the
command/query split.

## Target structure

```
apps/backend/src/users/
  users.module.ts             # controller + service + repository + handlers; exports NOTHING
  users.controller.ts         # HTTP, all under JwtAuthGuard, dispatches to the buses
  users.service.ts            # argon2, email conflicts, mapping to UserDto
  users.repository.ts         # the one place where the users table meets Prisma
  dto/{update-profile,change-password,delete-account}.dto.ts
  commands/                   # ← the module's public contract
    {register-user,update-user-profile,change-user-password,delete-user}.command.ts
    handlers/*.handler.ts + index.ts (USERS_COMMAND_HANDLERS)
  queries/                    # ← the module's public contract
    {get-user-by-id,verify-user-credentials}.query.ts
    handlers/*.handler.ts + index.ts (USERS_QUERY_HANDLERS)
  users.service.spec.ts
  users.cqrs.spec.ts
```

`commands/` and `queries/` are the only things other modules are allowed to import.
`AuthModule` imports the message classes from there (a plain TS import, not a Nest module import),
so no DI cycle arises.

## Message contract

Type safety comes from the `Command<R>` / `Query<TResult>` base classes in `@nestjs/cqrs`
(verified in 11.0.3): `commandBus.execute(new RegisterUserCommand(...))` infers `UserDto`
with no explicit generic parameters.

| Message                      | Payload                                | Result            | Handler exceptions                           |
| ---------------------------- | -------------------------------------- | ----------------- | -------------------------------------------- |
| `RegisterUserCommand`        | `email, password, name?`               | `UserDto`         | `ConflictException`                          |
| `UpdateUserProfileCommand`   | `userId, name?, email?`                | `UserDto`         | `ConflictException`, `NotFoundException`     |
| `ChangeUserPasswordCommand`  | `userId, currentPassword, newPassword` | `void`            | `UnauthorizedException`, `NotFoundException` |
| `DeleteUserCommand`          | `userId, password`                     | `void`            | `UnauthorizedException`, `NotFoundException` |
| `GetUserByIdQuery`           | `userId`                               | `UserDto \| null` | —                                            |
| `VerifyUserCredentialsQuery` | `email, password`                      | `UserDto \| null` | —                                            |

The password hash **never leaves `UsersService`**: only `UserDto` goes out.

## Endpoints

All under `JwtAuthGuard`; `userId` comes from `@CurrentUser()` only, never from the request body.
`GET /api/auth/me` stays as it is — no duplicate `GET /users/me` is added.

| Method   | Path                     | Body                               | Response          |
| -------- | ------------------------ | ---------------------------------- | ----------------- |
| `PATCH`  | `/api/users/me`          | `{ name?, email? }`                | `200` + `UserDto` |
| `PATCH`  | `/api/users/me/password` | `{ currentPassword, newPassword }` | `204`             |
| `DELETE` | `/api/users/me`          | `{ password }`                     | `204`             |

Validation is `class-validator` DTOs (per CLAUDE.md; the rules are not duplicated into `packages/shared`):
`@IsEmail`, `@MinLength(8) @MaxLength(72)` for `newPassword`, `@MaxLength(100)` for `name`.
Both fields in `UpdateProfileDto` are optional, but an empty body is rejected — otherwise a PATCH
with no fields would silently answer 200.

## Files

**`packages/database`**

- `prisma/schema.prisma:32` — `password` → `passwordHash`
- `prisma/migrations/<timestamp>_rename_password_to_password_hash/migration.sql` — new,
  the SQL is edited by hand (see below)
- `prisma/seed.ts:53` — `password:` → `passwordHash:`

**`packages/shared`**

- `src/types/user.ts` — new: `UserDto` moves here from `types/auth.ts`, joined by
  `UpdateProfileInput`, `ChangePasswordInput`, `DeleteAccountInput`. Re-export goes through
  `export *` in `src/index.ts`, so external `UserDto` imports do not break.
- `src/types/auth.ts` — drop `UserDto`, import it from `./user` for `AuthResponse`
- `src/index.ts` — `export * from "./types/user"`
- `src/constants/api-routes.ts` — a `users: { me: "users/me", password: "users/me/password" }` block

**`apps/backend`**

- `package.json` — the `@nestjs/cqrs` `^11.0.3` dependency (peer deps are compatible with Nest 11 / rxjs ^7.8.2)
- `src/app.module.ts` — `CqrsModule.forRoot()` and `UsersModule` in `imports`
- `src/users/**` — all new, per the structure above
- `src/auth/auth.service.ts` — injects `CommandBus` + `QueryBus` instead of `PrismaService`;
  `register` → `RegisterUserCommand`, `login` → `VerifyUserCredentialsQuery`,
  `findById` → `GetUserByIdQuery` + `UnauthorizedException` on `null`.
  argon2 and Prisma leave the file entirely.
- `src/auth/auth.module.ts` — no `UsersModule` import is added (the buses are global)
- `src/auth/auth.service.spec.ts` — new
- `test/app.e2e-spec.ts` — add 401-without-token checks for `PATCH /api/users/me` and
  `DELETE /api/users/me`

**What is reused rather than written from scratch:** `JwtAuthGuard`
(`src/auth/guards/jwt-auth.guard.ts`), `@CurrentUser()`
(`src/auth/decorators/current-user.decorator.ts`), `AuthenticatedUser` (`src/auth/types.ts`),
`PrismaService` (`src/prisma/prisma.service.ts`, global). The `interface UserRecord` +
private `toDto()` pattern comes from `src/categories/categories.service.ts:7-12,48-55`.

## Order of work

1. `pnpm --filter @expense-tracker/backend add @nestjs/cqrs`
2. **The rename migration.** By default Prisma will generate `DROP COLUMN` + `ADD COLUMN`,
   which destroys every hash. So:
   - edit `schema.prisma`
   - `pnpm --filter @expense-tracker/database exec prisma migrate dev --create-only --name rename_password_to_password_hash`
   - **read the generated `migration.sql`** and replace its body with
     `ALTER TABLE "users" RENAME COLUMN "password" TO "passwordHash";`
   - `pnpm db:migrate && pnpm db:generate`
   - update `seed.ts` and `auth.service.ts` so the tree compiles again
3. `packages/shared`: `types/user.ts`, edits to `auth.ts` / `index.ts` / `api-routes.ts`
4. `users/`: repository → service → commands/queries + handlers → DTOs → controller → module
5. Move `AuthService` onto the buses
6. Tests

## Pitfalls

- **`import type` breaks Nest DI.** Anything appearing in a constructor signature or in `@Body()`
  is imported as a value: `import { CommandBus }`, `import { UsersRepository }`,
  `import { UpdateProfileDto }`. The error shows up not in typing but as
  "Nest can't resolve dependencies" at startup (CLAUDE.md records this separately).
  The command class in `@CommandHandler(RegisterUserCommand)` is a value too.
- **Handlers are registered on `onApplicationBootstrap`** via `ExplorerService`. In tests
  where `init()` is not called, the bus will not see them and fails with `CommandHandlerNotFoundException`.
- **`apiClient.delete`** (`apps/frontend/src/lib/api-client.ts:64`) cannot send a body.
  We are not touching the frontend, but if `DELETE /users/me` is ever wired into the UI,
  the helper will need a body parameter.

## Tests

- **`users.service.spec.ts`** — unit tests with a mock repository, modelled on
  `src/expenses/expenses.service.spec.ts` (mock factory + `Test.createTestingModule`):
  email conflict on update, wrong current password, successful password change
  (asserting that what reaches the repository is the **hash**, not the raw password), user not found.
- **`users.cqrs.spec.ts`** — the one test that catches an unregistered handler
  (the main cause of CQRS failures at runtime). It builds a testing module with `CqrsModule.forRoot()`,
  all the handlers and a mock `UsersRepository`, calls `await moduleRef.init()` and runs
  every command and every query through the bus.
- **`auth.service.spec.ts`** — mock `CommandBus`/`QueryBus`: register returns a token,
  login on a `null` from the query gives 401, `/auth/me` on `null` gives 401 (not 404).
- **`test/app.e2e-spec.ts`** — plus two cases for 401 without a token.

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
docker compose up -d
pnpm db:migrate && pnpm db:generate && pnpm db:seed
pnpm --filter @expense-tracker/backend test:e2e
```

Manual acceptance (`pnpm dev`, Swagger at http://localhost:3001/api/docs):

1. Login as `demo@example.com` / `password123` — works after the column rename
   (proving the migration preserved the hashes rather than recreating the column).
2. `psql` → `\d users` shows a `passwordHash` column and **no** `password`.
3. `GET /api/auth/me` with a token → `UserDto`; without a token → 401.
4. `PATCH /api/users/me` changing the name → 200 and an updated `UserDto`;
   with an email that already belongs to another user → 409.
5. `PATCH /api/users/me/password` with a wrong `currentPassword` → 401; with the right one → 204,
   after which logging in with the old password gives 401 and with the new one gives 200.
6. `DELETE /api/users/me` with a wrong password → 401; with the right one → 204, after which
   `GET /api/auth/me` with the old token → **401**, and expenses and categories are cascade-deleted.
7. The frontend at http://localhost:3000 logs in and shows the expense list — the contract is intact.

## Out of scope

- `CategoriesService` / `ExpensesService` are **not rewritten** onto repositories and CQRS —
  they inject `PrismaService` directly. The inconsistency stays; note it with a
  comment in `users.repository.ts`.
- The frontend is untouched: the shape of `UserDto` does not change, and the new endpoints get no UI.
- There are no roles, token revocation, refresh rotation or rate limiting — CLAUDE.md records these as
  deliberate template simplifications. A consequence: **a deleted user's token stays valid
  until it expires**; requests return empty lists, because the rows went with the cascade.
  Document this as a known limitation.
- The `email` claim in the JWT goes stale after an email change. No check relies on it
  (everything uses `user.id`) — leave it, with a comment in `src/auth/types.ts`.
