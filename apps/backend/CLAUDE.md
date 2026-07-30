# CLAUDE.md — backend

This file provides guidance to Claude Code (claude.ai/code) when working in `apps/backend`. The
repository-wide rules — output language, git branches, commit messages, workspace commands, and the
cross-cutting architecture decisions — live in the root `CLAUDE.md` and still apply here.

## Guidance synchronization

Keep `apps/backend/AGENTS.md` and `apps/backend/CLAUDE.md` synchronized. Whenever guidance is added,
changed, or removed in either file, apply the equivalent change to the other file in the same task.

## Commands

```bash
pnpm --filter @expense-tracker/backend build
pnpm --filter @expense-tracker/backend test
pnpm --filter @expense-tracker/backend exec jest transactions.service  # by file
pnpm --filter @expense-tracker/backend exec jest -t "Decimal amounts"  # by test name
pnpm --filter @expense-tracker/backend test:e2e                        # needs a live DB
```

**The backend is Jest via `ts-jest`**, matching the CommonJS output Nest compiles to. The frontend
uses Vitest instead — that split is on purpose, not drift.

`pnpm test` at the root deliberately excludes e2e — `test/app.e2e-spec.ts` boots the real `AppModule`
and requires Postgres running and migrated. Run it with `pnpm test:e2e` from the root, which builds
the workspace dependencies first; CI runs the same command against a service container in the
**End-to-end tests** job.

Swagger is served at `:3001/api/docs` when `pnpm dev` is running.

## Architecture

**`AuthModule` reaches users only through the CQRS buses.** `src/users/commands/` and `queries/` are
the users module's entire public surface — `UsersModule` deliberately has no `exports`, and
`AuthService` injects `CommandBus`/`QueryBus` instead of `UsersService`. That is why `AuthService`
contains no Prisma and no argon2: hashing, uniqueness and storage all live behind `UsersService`,
which no other module can name. Adding `exports: [UsersService]` would quietly dissolve the boundary;
add a command or query instead. Note this pattern is scoped to users — `CategoriesService` and
`TransactionsService` still inject `PrismaService` directly, and were left that way on purpose.

**`transactionCount` lives on `CategoryListItemDto`, not on `CategoryDto`.** `GET /api/categories`
returns the extended type; every other place a category appears returns the flat one. The reason is
that `TransactionDto` embeds a copy of its category which `TransactionsService.toDto` assembles by
hand, so a required count on `CategoryDto` would force a wasted per-transaction aggregate. Related:
that hand-assembled copy means the `CategoryRecord` shape is duplicated in both services, so adding a
column to `Category` ripples through the schema, `packages/shared`, and each copy — `tsc` will say so,
but expect more than one file.

**Validation rules live in `class-validator` DTOs, not in `packages/shared`.** `@Min`, `@MaxLength`
and `@IsUUID` stay on the DTO and are never mirrored into the shared package, which holds request and
response _shapes_ only. `FindTransactionsQueryDto implements TransactionQuery` is what makes the
pairing load-bearing — drop a filter on one side and `tsc` fails on the other.

The `nestjs-best-practices` skill at `.claude/skills/nestjs-best-practices/SKILL.md` holds 40 NestJS
rules, one file per rule under `rules/`. Read its "In this repository" preamble first — four of its
rules contradict decisions documented below or in the root `CLAUDE.md`, and the `micro-*` category does
not apply to a single-app Turborepo. Most importantly, **`security-rate-limiting` must not be applied**:
its "Incorrect" example is this codebase's `login` and `forgot-password` endpoints, and the absence of
rate limiting here is a documented deliberate simplification, not an oversight. A generic best practice
never outranks this file.

## Constraints that look like mistakes but are not

**`PrismaExceptionFilter` and `LoggingInterceptor` are registered in `app.module.ts` via `APP_FILTER`
and `APP_INTERCEPTOR`, not in `main.ts`.** A global registered in `main.ts` is absent from every other
bootstrap, which is the bug `configure-app.ts` exists to fix for the `ValidationPipe`; putting these
in the module graph means `test/app.e2e-spec.ts` gets them for free. It is also load-bearing for the
filter specifically: `BaseExceptionFilter` receives its `HttpAdapterHost` by property injection, so a
hand-constructed `new PrismaExceptionFilter()` has no adapter to write a response with.
`app.module.spec.ts` asserts both registrations, and the filter's spec boots a real app to prove the
injected path answers over HTTP.

**The filter translates rather than formats.** It maps P2002 → 409, P2003 → 400 and P2025 → 404 by
handing `BaseExceptionFilter` the matching `HttpException`, so a lost race renders the identical body
to a thrown 409 — the shape `errorSchema()` publishes. Building a response object in the filter would
create a second dialect of error body. An unrecognised code stays a 500 on purpose: guessing a 4xx
would report a server fault as the caller's mistake. `CategoriesService.remove` keeps its own P2003
catch because that path means "dependents remain" and answers **409**, not the filter's generic 400 —
local handling wins, the filter is the safety net.

**Request-handling configuration lives in `configure-app.ts`, called by both `main.ts` and the e2e
harness.** It was duplicated and had drifted: the e2e suite built its own `ValidationPipe` without
`forbidNonWhitelisted` or implicit conversion, so it ran against a laxer server than production and
could not catch a regression in either the unknown-property 400 or query-param coercion. Anything
that decides whether a request is accepted belongs in that function. CORS and Swagger stay in
`bootstrap`, since neither can make a test pass that should fail.

**`main.ts` must call `app.enableShutdownHooks()`.** Nest runs `onModuleDestroy` only from
`app.close()`, and nothing closes the app on a signal without it — so `PrismaService.onModuleDestroy`,
written to drain the pg pool, was unreachable in production and a `docker stop` killed the process
with connections open. `main.spec.ts` asserts the call.

**`typescript/consistent-type-imports` is explicitly off for NestJS.** Its autofix can rewrite
`import { PrismaService }` into `import type`, erasing the `emitDecoratorMetadata` Nest's DI reads at
runtime; the backend then dies at boot with "Nest can't resolve dependencies." Use value imports for
anything in a constructor signature or `@Body()` parameter regardless.

**`ConfigModule`'s `envFilePath` is anchored to `__dirname`, not a relative string.** cwd differs
between `turbo dev` (cwd = `apps/backend`) and `pnpm --filter @expense-tracker/backend start:prod`
from the root.

**`app.module.ts` registers `CqrsModule.forRoot()`, not a bare `CqrsModule`.** Only the dynamic form
is marked `global: true`; the plain class is a normal module every consumer would have to import.
"Simplifying" it back to `CqrsModule` costs nothing at compile time and fails at boot with
`Nest can't resolve CommandBus`. Related: `CqrsModule` discovers handlers in
`onApplicationBootstrap`, so a testing module must `await moduleRef.init()` before any bus call —
`compile()` alone leaves the buses empty and every `execute()` throws
`CommandHandlerNotFoundException`.

**`Category.icon` is validated by grapheme count (`IsSingleEmoji`), never by `@MaxLength`.**
`class-validator` measures UTF-16 code units and `"👨‍👩‍👧‍👦".length === 11`, so any length cap rejects most
real emoji. `categories/validators/is-single-emoji.ts` segments with `Intl.Segmenter` and requires
exactly one cluster. `\p{Regional_Indicator}` is in the alternation on purpose: flags (🇺🇸) are one
grapheme but are _not_ `Extended_Pictographic` and would otherwise be refused. Keycaps (1️⃣) stay
rejected — that is a digit plus a combining frame, which is not what an icon field wants.

**`PasswordResetToken.tokenHash` is a SHA-256 digest, not an argon2 hash.** Next to `passwordHash`
this looks like an inconsistency; it isn't. argon2 salts each hash independently, so finding a row by
a raw token would mean `argon2.verify` against every row in the table. The token is 32 random bytes
from `crypto.randomBytes` — unguessable on its own — so it doesn't need a slow KDF, and SHA-256 being
deterministic is what lets the column carry `@unique` and be found with one indexed lookup
(`UsersService.hashToken`, `PasswordResetTokenRepository.findByTokenHash`).

**Swagger reflects over classes, and every response type here is a plain interface from
`packages/shared`.** `getSchemaPath()` has nothing to point at, so response schemas are hand-written:
`paginatedSchema()` and `errorSchema()` in `common/swagger/` for the page envelope and the error body,
`TRANSACTION_SCHEMA` / `TRANSACTION_SUMMARY_SCHEMA` in `transactions/` for the payloads. Hand-written
means it can drift; when a field is added to `TransactionDto`, add it there too. Request bodies need
none of this — `CreateTransactionDto` and `UpdateTransactionDto` are decorated classes and document
themselves.

## Conventions

- A documented endpoint carries `@ApiOperation` plus one response decorator per status it can answer, success and error alike. The 401 goes on the controller class next to `@ApiBearerAuth` rather than on all six methods — `@ApiUnauthorizedResponse` is inherited by every route, and the guard it describes is registered at class level too. `TransactionsController` is the worked example.
- Every query and mutation is scoped by `userId`. Deletes use `deleteMany({ where: { id, userId } })` and check `count === 0` rather than `delete` + ownership lookup, so one user cannot touch another's rows. Updates carry `where: { id, userId }` for the same reason — Prisma's extended `where` accepts the non-unique field alongside the id — even though `findOne`/`findFirst` has already proved ownership a line earlier: scoping belongs in the statement, not only in a preceding check, and a row that stops matching raises P2025, which `PrismaExceptionFilter` answers as the 404 those methods already document. `TransactionsService.assertCategoryBelongsToUser` exists for the same reason.
- A uniqueness check inside an update must exclude the row being edited — `if (existing && existing.id !== id)` in `CategoriesService.update`. `@@unique([userId, name])` makes the naive `create`-style check answer **409 for a save that did not rename anything**.
- Partial updates distinguish "omitted" from "cleared" with the `...(dto.x !== undefined && { x: dto.x })` spread: `undefined` leaves the column alone, `null` clears it. For this to be typed rather than accidental, `color` and `icon` are declared `string | null` on **`CreateCategoryDto`** — `UpdateCategoryDto` is `PartialType(CreateCategoryDto)`, so the update side cannot be widened alone, and the frontend's `apiClient.patch` takes an `unknown` body that would happily send a `null` no DTO admits.
- The service layer converts money input with `.toFixed(2)` rather than passing raw JS numbers to Prisma. See the money contract in the root `CLAUDE.md`.
- `page` is capped at 10,000 by `FindTransactionsQueryDto`. The cap is a cost control, not a product rule: `skip` becomes a SQL `OFFSET`, which Postgres answers by walking and discarding every preceding row, so an unbounded `?page=` sells an arbitrarily expensive scan on an API with no rate limiting.
- A new command or query handler must be added to `USERS_COMMAND_HANDLERS` / `USERS_QUERY_HANDLERS`. Forgetting is invisible to `tsc` and surfaces only as a runtime `CommandHandlerNotFoundException`; `users.cqrs.spec.ts` exists to catch it and is worth extending alongside any new message.
- `RegisterUserCommand`, `ChangeUserPasswordCommand`, `DeleteUserCommand`, `ResetUserPasswordCommand` and `VerifyUserCredentialsQuery` carry plaintext passwords, and both buses hand every message to their publisher. The in-memory default discards it, but any logging or tracing publisher added later must redact those fields. `ResetUserPasswordCommand` also carries the raw reset `token` itself — a live single-use credential, not just a password — and that field needs redacting too. `RequestPasswordResetCommand` is the one exception worth noting explicitly: it carries only an email, never the raw reset token — see `RequestPasswordResetHandler`, which is deliberately the only non-thin handler in the users module because composing and logging the reset URL is the one place that raw token is allowed to exist outside `UsersService`.
- `UsersRepository`'s "the one place the `users` table meets Prisma" claim has one exception: `UsersService.resetPassword`'s transaction writes `users` directly, because Prisma's interactive `$transaction` needs both of its writes on the same `tx` client and the repository's methods return already-settled promises, not the `PrismaPromise`s the array form of `$transaction` requires. If you're touching that method, keep the docstrings in `users.repository.ts` and `users.service.ts` in sync rather than re-hiding the exception.
- `GetUserByIdQuery` resolves to `UserDto | null` rather than throwing, because the caller owns the status code: `GET /auth/me` must answer **401** for a token naming a deleted user, since the frontend clears its stored token on 401 and on nothing else (`ApiError.isUnauthorized`). A 404 there strands the client holding a token that can never work.

## Updating Documentation

After changing any methods, you must update or add JSDoc. And add Swagger decorators for DTOs and controllers.
