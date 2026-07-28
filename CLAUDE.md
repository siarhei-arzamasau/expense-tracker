# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Guidance synchronization

Keep `AGENTS.md` and `CLAUDE.md` synchronized. Whenever guidance is added, changed, or removed in either file, apply the equivalent change to the other file in the same task.

## Output language

**Everything you produce is in English, whatever language the request arrives in.** Plans, code, comments, commit messages, documentation, PR descriptions, and chat replies — all English, including when the prompt, an issue, or a pasted spec is in Russian. Translate rather than mirror the input language.

Two things this rule does not do. It does not ask you to rewrite existing Russian text you happen to read — the `PasswordResetToken.tokenHash` doc comment in `schema.prisma` is in Russian and stays that way, because it is a dated record of a past decision; a plan or doc quoting a schema comment quotes it verbatim rather than translating it, so that the quote keeps matching the code. And it does not apply to user-facing product strings, which follow whatever the feature requires.

## Git branches

Use GitHub Flow for all repository changes:

- `main` is the only long-lived branch and must remain deployable. Do not commit feature work directly to it.
- Start each change from an up-to-date `main` in a dedicated, short-lived branch.
- Name branches `<type>/<short-kebab-case-description>`, using `feature`, `fix`, `docs`, `refactor`, `test`, or `chore` as the type; for example, `feature/frontend-homepage`.
- Keep each branch focused on one coherent change. Bring `main` into the branch before merging when needed to resolve divergence.
- Merge into `main` through a pull request only after the relevant checks pass and review is complete. Delete the branch after merge.
- Do not introduce a `develop` branch or other long-lived integration branches unless the repository workflow is explicitly changed.

## Git commits

**Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).**

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

- **Type** is required and lowercase: `feat` for a new capability, `fix` for a bug fix, and `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `style` for the rest. `style` means formatting only — an Oxfmt pass, not a visual redesign; changing how a page looks is `feat` or `fix`.
- **Scope** is optional, and when present is a noun in parentheses naming a part of the codebase — a workspace (`backend`, `frontend`, `database`, `shared`) or a module (`auth`, `users`, `categories`, `transactions`).
- **Description** is imperative mood, lowercase, no trailing period, header under ~72 characters: `feat(auth): add forgot/reset password endpoints`, never `Added ...`.
- **Body** starts one blank line after the description and explains _why_; the diff already says what.
- **Breaking changes** take a `!` before the colon (`feat(shared)!: ...`) and/or a `BREAKING CHANGE: <explanation>` footer. Other footer tokens use hyphens instead of spaces (`Reviewed-by: ...`).
- English, always — see **Output language** above.

Two things to know. **Nothing enforces this.** `.husky/pre-commit` runs `lint-staged` and that is all — there is no `commit-msg` hook and no commitlint, so a malformed message is accepted silently. And **`git log` is not a style reference here**: history predating this rule is mostly sentence-case subjects with no type prefix (`Add category management`), with two stray conventional ones mixed in. Follow the spec rather than the neighbouring commits, and leave the existing messages alone — rewriting published history to match is not worth it.

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
| `pnpm format` / `pnpm format:check` / `pnpm lint:fix`       | Oxfmt write/check and safe Oxlint fixes                  |
| `pnpm test`                                                 | backend unit specs only                                  |
| `pnpm db:migrate` / `db:generate` / `db:seed` / `db:studio` | proxied to `packages/database`                           |

Scoping to one package uses `pnpm --filter <name> <script>`, e.g. `pnpm --filter @expense-tracker/backend build`.

**Single test:**

```bash
pnpm --filter @expense-tracker/backend exec jest transactions.service  # by file
pnpm --filter @expense-tracker/backend exec jest -t "Decimal amounts"  # by test name
pnpm --filter @expense-tracker/backend test:e2e                        # needs a live DB
```

`pnpm test` deliberately excludes e2e — `test/app.e2e-spec.ts` boots the real `AppModule` and requires Postgres running and migrated.

Seeded login: `demo@example.com` / `password123`.

## Architecture

**Dependency direction is the load-bearing decision.** `packages/database` is a dependency of `apps/backend` **only** — never the frontend. The frontend talks to the backend over HTTP and imports types from `packages/shared`. This gives the generated Prisma client exactly one runtime consumer (NestJS, CommonJS), which is why `schema.prisma` can set `moduleFormat = "cjs"` and sidestep the ESM/CJS dual-format problem entirely. Do not add `@expense-tracker/database` to the frontend; add the type to `packages/shared` instead.

**`packages/database` and `packages/shared` compile to `dist/` via `tsc`** and are consumed as built output, not source. `nest build` only compiles its own `rootDir`, so the consume-as-source pattern would not work here.

**Validation lives in NestJS `class-validator` DTOs; `packages/shared` holds only response types and route constants.** Zod is used on the frontend for `react-hook-form` and nowhere else. Don't duplicate validation rules into `packages/shared`.

**`AuthModule` reaches users only through the CQRS buses.** `apps/backend/src/users/commands/` and `queries/` are the users module's entire public surface — `UsersModule` deliberately has no `exports`, and `AuthService` injects `CommandBus`/`QueryBus` instead of `UsersService`. That is why `AuthService` contains no Prisma and no argon2: hashing, uniqueness and storage all live behind `UsersService`, which no other module can name. Adding `exports: [UsersService]` would quietly dissolve the boundary; add a command or query instead. Note this pattern is scoped to users — `CategoriesService` and `TransactionsService` still inject `PrismaService` directly, and were left that way on purpose.

**`transactionCount` lives on `CategoryListItemDto`, not on `CategoryDto`.** `GET /api/categories` returns the extended type; every other place a category appears returns the flat one. The reason is that `TransactionDto` embeds a copy of its category which `TransactionsService.toDto` assembles by hand, so a required count on `CategoryDto` would force a wasted per-transaction aggregate. Related: that hand-assembled copy means the `CategoryRecord` shape is duplicated in both services, so adding a column to `Category` ripples through the schema, `packages/shared`, and each copy — `tsc` will say so, but expect more than one file.

## Constraints that look like mistakes but are not

**TypeScript is pinned to `^5.9.3` while `latest` is 7.x.** `ts-jest` declares
`typescript: ">=4.3 <7"`, so TypeScript 7 is excluded by the test toolchain. Do not bump to 7
until `ts-jest` supports it. Same reasoning for `@types/node ^24.13.3` rather than 26.x — it
tracks the Node 24 runtime.

**`turbo/no-undeclared-env-vars` is the one rule that does not run as a native Oxlint rule.**
`oxlint.config.ts` loads `eslint-plugin-turbo` through Oxlint's alpha JavaScript-plugin bridge.
Keep the dependency and expect bridge compatibility to need verification on upgrades.

**Oxlint type-aware linting is disabled, and `typescript/consistent-type-imports` is explicitly
off for NestJS.** Its autofix can rewrite `import { PrismaService }` into `import type`, erasing
the `emitDecoratorMetadata` Nest's DI reads at runtime; the backend then dies at boot with
"Nest can't resolve dependencies." Use value imports for anything in a constructor signature
or `@Body()` parameter regardless.

**Prisma 7 differs from every v6 tutorial in three ways.** The `datasource` block has no `url` — connection URLs live in `packages/database/prisma.config.ts`. Prisma no longer auto-loads `.env`, and a bare `import "dotenv/config"` is insufficient because the CLI's cwd is `packages/database` while `.env` is at the repo root; `prisma.config.ts` resolves it explicitly. And **`new PrismaClient()` with no options throws** — v7 requires a driver adapter. Go through `createPrismaClient()` / `createPgAdapter()` in `packages/database/src/client.ts`, which is the single place `@prisma/adapter-pg` is wired; `PrismaService` passes the adapter via `super()`. The generator sets `output`, `moduleFormat`, and `importFileExtension` explicitly because the latter two otherwise default to "inferred from environment."

**`prisma generate` is owned by `turbo.json`, not by the build script.** `packages/database`'s `build` is `tsc` alone. Putting `prisma generate &&` back into it would run it twice and let Turbo cache a `dist` built from generated sources it does not track, then restore that cache into a tree where the gitignored `src/generated/` is absent.

**`pnpm-workspace.yaml` uses `allowBuilds` (a map), NOT pnpm 10's `onlyBuiltDependencies` (a list).** pnpm 11 renamed it and silently ignores the old key, so an install that should have been gated instead _reports success_ while leaving Prisma without engines and argon2 without a native binary. The tell is `ERR_PNPM_IGNORED_BUILDS` in the install output. Add an entry here when introducing a dependency with a postinstall step.

**`ConfigModule`'s `envFilePath` is anchored to `__dirname`, not a relative string.** cwd differs between `turbo dev` (cwd = `apps/backend`) and `pnpm --filter @expense-tracker/backend start:prod` from the root.

**Money is `Decimal(12, 2)` in Postgres and a `string` over JSON.** `TransactionDto.amount` is typed `string` on purpose — Prisma serializes Decimal to a string to avoid float drift. Parse only at the display boundary (`apps/frontend/src/lib/format.ts`); arithmetic on it elsewhere silently produces wrong money. Service layer converts input with `.toFixed(2)` rather than passing raw JS numbers to Prisma.

**`app.module.ts` registers `CqrsModule.forRoot()`, not a bare `CqrsModule`.** Only the dynamic form is marked `global: true`; the plain class is a normal module every consumer would have to import. "Simplifying" it back to `CqrsModule` costs nothing at compile time and fails at boot with `Nest can't resolve CommandBus`. Related: `CqrsModule` discovers handlers in `onApplicationBootstrap`, so a testing module must `await moduleRef.init()` before any bus call — `compile()` alone leaves the buses empty and every `execute()` throws `CommandHandlerNotFoundException`.

**`20260728035150_rename_password_to_password_hash/migration.sql` is hand-written, and column renames generally have to be.** `prisma migrate dev` renders a rename as `DROP COLUMN` + `ADD COLUMN`, which destroys every stored hash, and then refuses to run at all because the environment is non-interactive and it wants confirmation for the data loss. The file contains `ALTER TABLE "users" RENAME COLUMN` instead, applied with `prisma migrate deploy`. `.oxfmtrc.jsonc` exempts `packages/database/prisma/migrations`, so hand-edited SQL stays as written.

**`Category.icon` is validated by grapheme count (`IsSingleEmoji`), never by `@MaxLength`.** `class-validator` measures UTF-16 code units and `"👨‍👩‍👧‍👦".length === 11`, so any length cap rejects most real emoji. `categories/validators/is-single-emoji.ts` segments with `Intl.Segmenter` and requires exactly one cluster. `\p{Regional_Indicator}` is in the alternation on purpose: flags (🇺🇸) are one grapheme but are _not_ `Extended_Pictographic` and would otherwise be refused. Keycaps (1️⃣) stay rejected — that is a digit plus a combining frame, which is not what an icon field wants.

**Build failures inside `packages/database/src/generated/` are not user code.** The Prisma client ships as TypeScript source and compiles under our `strict` config; `skipLibCheck` does not apply because these are `.ts`, not `.d.ts`. Never edit those files — `pnpm db:generate` overwrites them.

**`PasswordResetToken.tokenHash` is a SHA-256 digest, not an argon2 hash.** Next to `passwordHash` this looks like an inconsistency; it isn't. argon2 salts each hash independently, so finding a row by a raw token would mean `argon2.verify` against every row in the table. The token is 32 random bytes from `crypto.randomBytes` — unguessable on its own — so it doesn't need a slow KDF, and SHA-256 being deterministic is what lets the column carry `@unique` and be found with one indexed lookup (`UsersService.hashToken`, `PasswordResetTokenRepository.findByTokenHash`).

**shadcn/ui is installed but only used under `apps/frontend/src/app/{login,forgot-password,reset-password,terms,privacy}`.** `/categories` and `/transactions` stay on their pre-existing hand-written Tailwind classes — that split is intentional (see `2026-07-28-category-management.md`, which rejected installing shadcn for that feature as scope creep, and `2026-07-28-auth-pages.md`, where the auth pages' own requirement asked for shadcn components). Don't "clean up" the inconsistency by migrating one side to match the other outside of a task that asks for it.

## Conventions

- Every query and mutation is scoped by `userId`. Deletes use `deleteMany({ where: { id, userId } })` and check `count === 0` rather than `delete` + ownership lookup, so one user cannot touch another's rows. `TransactionsService.assertCategoryBelongsToUser` exists for the same reason.
- A uniqueness check inside an update must exclude the row being edited — `if (existing && existing.id !== id)` in `CategoriesService.update`. `@@unique([userId, name])` makes the naive `create`-style check answer **409 for a save that did not rename anything**.
- Partial updates distinguish "omitted" from "cleared" with the `...(dto.x !== undefined && { x: dto.x })` spread: `undefined` leaves the column alone, `null` clears it. For this to be typed rather than accidental, `color` and `icon` are declared `string | null` on **`CreateCategoryDto`** — `UpdateCategoryDto` is `PartialType(CreateCategoryDto)`, so the update side cannot be widened alone, and `apiClient.patch` takes an `unknown` body that would happily send a `null` no DTO admits.
- Any category mutation must invalidate `["transactions"]` as well as `["categories"]` (`apps/frontend/src/app/categories/page.tsx`). `TransactionDto` carries a snapshot of its category, so without the second invalidation a renamed or recoloured category keeps rendering stale in the transactions table.
- Category search and the transaction category filter are client-side on purpose: `findAll` already puts every one of the user's categories in the TanStack Query cache and transactions are unpaginated, so a server-side `?search=` would buy nothing at these sizes.
- Formatting and linting policy lives at the repository root in `.oxfmtrc.jsonc` and
  `oxlint.config.ts`; package scripts should keep calling `oxlint .` so filtered linting works.
- Route paths come from `API_ROUTES` in `packages/shared`, so a rename on one side is a type error on the other.
- Auth is a bearer token in `localStorage`, no refresh rotation, no rate limiting — deliberate learning-template simplifications documented in the README, not oversights to silently "fix." A consequence of no revocation: after `DELETE /api/users/me` the token stays valid until it expires, and requests made with it return empty lists because the rows went with the cascade. `categories/page.tsx` and `transactions/page.tsx` call `authStorage.clear()` before redirecting to `/login` on a 401, so this is the only place a stored token is ever discarded client-side.
- A new command or query handler must be added to `USERS_COMMAND_HANDLERS` / `USERS_QUERY_HANDLERS`. Forgetting is invisible to `tsc` and surfaces only as a runtime `CommandHandlerNotFoundException`; `users.cqrs.spec.ts` exists to catch it and is worth extending alongside any new message.
- `RegisterUserCommand`, `ChangeUserPasswordCommand`, `DeleteUserCommand`, `ResetUserPasswordCommand` and `VerifyUserCredentialsQuery` carry plaintext passwords, and both buses hand every message to their publisher. The in-memory default discards it, but any logging or tracing publisher added later must redact those fields. `ResetUserPasswordCommand` also carries the raw reset `token` itself — a live single-use credential, not just a password — and that field needs redacting too. `RequestPasswordResetCommand` is the one exception worth noting explicitly: it carries only an email, never the raw reset token — see `RequestPasswordResetHandler`, which is deliberately the only non-thin handler in the users module because composing and logging the reset URL is the one place that raw token is allowed to exist outside `UsersService`.
- `UsersRepository`'s "the one place the `users` table meets Prisma" claim has one exception: `UsersService.resetPassword`'s transaction writes `users` directly, because Prisma's interactive `$transaction` needs both of its writes on the same `tx` client and the repository's methods return already-settled promises, not the `PrismaPromise`s the array form of `$transaction` requires. If you're touching that method, keep the docstrings in `users.repository.ts` and `users.service.ts` in sync rather than re-hiding the exception.
- `GetUserByIdQuery` resolves to `UserDto | null` rather than throwing, because the caller owns the status code: `GET /auth/me` must answer **401** for a token naming a deleted user, since the frontend clears its stored token on 401 and on nothing else (`ApiError.isUnauthorized`). A 404 there strands the client holding a token that can never work.
