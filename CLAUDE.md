# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Expense tracker: Turborepo + pnpm workspaces, Next.js 16 frontend, NestJS 11 backend, PostgreSQL 17 via Prisma 7.

Installed and verified: `typecheck`, `lint`, `build`, `test`, and `format:check` all pass. On a **fresh clone** nothing typechecks until `pnpm install` + `pnpm db:generate` have run, because the generated Prisma client is gitignored — a wall of unresolved imports at that point is expected, not a bug.

```bash
nvm use && cp .env.example .env      # Node 24.18.0
pnpm install
docker compose up -d                  # Postgres 17 on :5432
pnpm db:generate && pnpm db:migrate && pnpm db:seed
```

## Commands

Run from the repo root; Turborepo fans out in dependency order.

| Command                                                     | Notes                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                                  | frontend :3000, backend :3001, Swagger at :3001/api/docs |
| `pnpm build` / `pnpm typecheck` / `pnpm lint`               | whole workspace                                          |
| `pnpm test`                                                 | backend unit specs only                                  |
| `pnpm db:migrate` / `db:generate` / `db:seed` / `db:studio` | proxied to `packages/database`                           |

Scoping to one package uses `pnpm --filter <name> <script>`, e.g. `pnpm --filter @expense-tracker/backend build`.

**Single test:**

```bash
pnpm --filter @expense-tracker/backend exec jest expenses.service      # by file
pnpm --filter @expense-tracker/backend exec jest -t "Decimal amounts"  # by test name
pnpm --filter @expense-tracker/backend test:e2e                        # needs a live DB
```

`pnpm test` deliberately excludes e2e — `test/app.e2e-spec.ts` boots the real `AppModule` and requires Postgres running and migrated.

Seeded login: `demo@example.com` / `password123`.

## Architecture

**Dependency direction is the load-bearing decision.** `packages/database` is a dependency of `apps/backend` **only** — never the frontend. The frontend talks to the backend over HTTP and imports types from `packages/shared`. This gives the generated Prisma client exactly one runtime consumer (NestJS, CommonJS), which is why `schema.prisma` can set `moduleFormat = "cjs"` and sidestep the ESM/CJS dual-format problem entirely. Do not add `@expense-tracker/database` to the frontend; add the type to `packages/shared` instead.

**`packages/database` and `packages/shared` compile to `dist/` via `tsc`** and are consumed as built output, not source. `nest build` only compiles its own `rootDir`, so the consume-as-source pattern would not work here.

**Validation lives in NestJS `class-validator` DTOs; `packages/shared` holds only response types and route constants.** Zod is used on the frontend for `react-hook-form` and nowhere else. Don't duplicate validation rules into `packages/shared`.

**`AuthModule` reaches users only through the CQRS buses.** `apps/backend/src/users/commands/` and `queries/` are the users module's entire public surface — `UsersModule` deliberately has no `exports`, and `AuthService` injects `CommandBus`/`QueryBus` instead of `UsersService`. That is why `AuthService` contains no Prisma and no argon2: hashing, uniqueness and storage all live behind `UsersService`, which no other module can name. Adding `exports: [UsersService]` would quietly dissolve the boundary; add a command or query instead. Note this pattern is scoped to users — `CategoriesService` and `ExpensesService` still inject `PrismaService` directly, and were left that way on purpose.

## Constraints that look like mistakes but are not

**TypeScript is pinned to `^5.9.3` while `latest` is 7.x.** `typescript-eslint` declares `typescript: ">=4.8.4 <6.1.0"` and `ts-jest` declares `>=4.3 <7`. TS 6 and 7 are excluded by our own lint and test toolchain. Do not bump it until both ship support. Same reasoning for `@types/node ^24.13.3` rather than 26.x — it tracks the Node 24 runtime.

**ESLint is pinned to `^9.39.5` while `latest` is 10.x.** `typescript-eslint` does support ESLint 10, but `eslint-config-next`'s transitive plugins (`eslint-plugin-react`, `-import`, `-jsx-a11y`) cap at `^9` and call `scopeManager.addGlobals`, removed in ESLint 10. Frontend lint dies with `TypeError: scopeManager.addGlobals is not a function`. When evaluating an ESLint bump, the Next plugins are the binding constraint, not `typescript-eslint`.

**`@typescript-eslint/consistent-type-imports` is not enabled anywhere, and turning it on requires solving two separate problems.** It needs type-aware linting, which `eslint-config-next`'s parser does not provide (it doesn't forward `parserOptions.project`), so it throws on every frontend file. Independently, its autofix rewrites `import { PrismaService }` into `import type`, erasing the `emitDecoratorMetadata` Nest's DI reads at runtime — the backend then dies at boot with "Nest can't resolve dependencies." Use value imports for anything in a constructor signature or `@Body()` parameter regardless.

**Prisma 7 differs from every v6 tutorial in three ways.** The `datasource` block has no `url` — connection URLs live in `packages/database/prisma.config.ts`. Prisma no longer auto-loads `.env`, and a bare `import "dotenv/config"` is insufficient because the CLI's cwd is `packages/database` while `.env` is at the repo root; `prisma.config.ts` resolves it explicitly. And **`new PrismaClient()` with no options throws** — v7 requires a driver adapter. Go through `createPrismaClient()` / `createPgAdapter()` in `packages/database/src/client.ts`, which is the single place `@prisma/adapter-pg` is wired; `PrismaService` passes the adapter via `super()`. The generator sets `output`, `moduleFormat`, and `importFileExtension` explicitly because the latter two otherwise default to "inferred from environment."

**`prisma generate` is owned by `turbo.json`, not by the build script.** `packages/database`'s `build` is `tsc` alone. Putting `prisma generate &&` back into it would run it twice and let Turbo cache a `dist` built from generated sources it does not track, then restore that cache into a tree where the gitignored `src/generated/` is absent.

**`pnpm-workspace.yaml` uses `allowBuilds` (a map), NOT pnpm 10's `onlyBuiltDependencies` (a list).** pnpm 11 renamed it and silently ignores the old key, so an install that should have been gated instead _reports success_ while leaving Prisma without engines and argon2 without a native binary. The tell is `ERR_PNPM_IGNORED_BUILDS` in the install output. Add an entry here when introducing a dependency with a postinstall step.

**`ConfigModule`'s `envFilePath` is anchored to `__dirname`, not a relative string.** cwd differs between `turbo dev` (cwd = `apps/backend`) and `pnpm --filter @expense-tracker/backend start:prod` from the root.

**Money is `Decimal(12, 2)` in Postgres and a `string` over JSON.** `ExpenseDto.amount` is typed `string` on purpose — Prisma serializes Decimal to a string to avoid float drift. Parse only at the display boundary (`apps/frontend/src/lib/format.ts`); arithmetic on it elsewhere silently produces wrong money. Service layer converts input with `.toFixed(2)` rather than passing raw JS numbers to Prisma.

**`app.module.ts` registers `CqrsModule.forRoot()`, not a bare `CqrsModule`.** Only the dynamic form is marked `global: true`; the plain class is a normal module every consumer would have to import. "Simplifying" it back to `CqrsModule` costs nothing at compile time and fails at boot with `Nest can't resolve CommandBus`. Related: `CqrsModule` discovers handlers in `onApplicationBootstrap`, so a testing module must `await moduleRef.init()` before any bus call — `compile()` alone leaves the buses empty and every `execute()` throws `CommandHandlerNotFoundException`.

**`20260728035150_rename_password_to_password_hash/migration.sql` is hand-written, and column renames generally have to be.** `prisma migrate dev` renders a rename as `DROP COLUMN` + `ADD COLUMN`, which destroys every stored hash, and then refuses to run at all because the environment is non-interactive and it wants confirmation for the data loss. The file contains `ALTER TABLE "users" RENAME COLUMN` instead, applied with `prisma migrate deploy`. `.prettierignore` already exempts `packages/database/prisma/migrations`, so hand-edited SQL stays as written.

**Build failures inside `packages/database/src/generated/` are not user code.** The Prisma client ships as TypeScript source and compiles under our `strict` config; `skipLibCheck` does not apply because these are `.ts`, not `.d.ts`. Never edit those files — `pnpm db:generate` overwrites them.

## Conventions

- Every query and mutation is scoped by `userId`. Deletes use `deleteMany({ where: { id, userId } })` and check `count === 0` rather than `delete` + ownership lookup, so one user cannot touch another's rows. `ExpensesService.assertCategoryBelongsToUser` exists for the same reason.
- `@expense-tracker/eslint-config` exports `base` and `nest` only. Next's rules are composed in `apps/frontend/eslint.config.mjs` directly from `eslint-config-next`, which is version-locked to Next and would otherwise couple every package's lint to the frontend's framework version.
- Route paths come from `API_ROUTES` in `packages/shared`, so a rename on one side is a type error on the other.
- Auth is a bearer token in `localStorage`, no refresh rotation, no rate limiting — deliberate learning-template simplifications documented in the README, not oversights to silently "fix." A consequence of no revocation: after `DELETE /api/users/me` the token stays valid until it expires, and requests made with it return empty lists because the rows went with the cascade.
- A new command or query handler must be added to `USERS_COMMAND_HANDLERS` / `USERS_QUERY_HANDLERS`. Forgetting is invisible to `tsc` and surfaces only as a runtime `CommandHandlerNotFoundException`; `users.cqrs.spec.ts` exists to catch it and is worth extending alongside any new message.
- `RegisterUserCommand`, `ChangeUserPasswordCommand`, `DeleteUserCommand` and `VerifyUserCredentialsQuery` carry plaintext passwords, and both buses hand every message to their publisher. The in-memory default discards it, but any logging or tracing publisher added later must redact those fields.
- `GetUserByIdQuery` resolves to `UserDto | null` rather than throwing, because the caller owns the status code: `GET /auth/me` must answer **401** for a token naming a deleted user, since the frontend clears its stored token on 401 and on nothing else (`ApiError.isUnauthorized`). A 404 there strands the client holding a token that can never work.
