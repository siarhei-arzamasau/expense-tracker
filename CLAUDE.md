# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Expense tracker: Turborepo + pnpm workspaces, Next.js 16 frontend, NestJS 11 backend, PostgreSQL 17 via Prisma 7.

This started as a hand-written template scaffolded **without installing dependencies**. If `node_modules/` is absent, nothing has been validated by a compiler yet — run the bootstrap below before trusting any "it's broken" signal. A wall of unresolved-import errors before `pnpm install` + `pnpm db:generate` is expected, not a bug.

```bash
nvm use && cp .env.example .env      # Node 24.18.0
pnpm install
docker compose up -d                  # Postgres 17 on :5432
pnpm db:generate && pnpm db:migrate && pnpm db:seed
```

## Commands

Run from the repo root; Turborepo fans out in dependency order.

| Command | Notes |
| --- | --- |
| `pnpm dev` | frontend :3000, backend :3001, Swagger at :3001/api/docs |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` | whole workspace |
| `pnpm test` | backend unit specs only |
| `pnpm db:migrate` / `db:generate` / `db:seed` / `db:studio` | proxied to `packages/database` |

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

## Constraints that look like mistakes but are not

**TypeScript is pinned to `^5.9.3` while `latest` is 7.x.** `typescript-eslint` declares `typescript: ">=4.8.4 <6.1.0"` and `ts-jest` declares `>=4.3 <7`. TS 6 and 7 are excluded by our own lint and test toolchain. Do not bump it until both ship support. Same reasoning for `@types/node ^24.13.3` rather than 26.x — it tracks the Node 24 runtime.

**`consistent-type-imports` is OFF for the backend** (`packages/eslint-config/nest.mjs`). Its autofixer rewrites `import { PrismaService }` into `import type`, which erases the `emitDecoratorMetadata` that Nest's DI reads at runtime. The app then dies at boot with "Nest can't resolve dependencies." Never enable it there, and use value imports for anything appearing in a constructor signature or `@Body()` parameter.

**Prisma 7 differs from every v6 tutorial.** The `datasource` block has no `url` — connection URLs live in `packages/database/prisma.config.ts`. Prisma no longer auto-loads `.env`, and a bare `import "dotenv/config"` is insufficient because the CLI's cwd is `packages/database` while `.env` is at the repo root; `prisma.config.ts` resolves it explicitly. The generator sets `output`, `moduleFormat`, and `importFileExtension` explicitly because the latter two otherwise default to "inferred from environment."

**`prisma generate` is owned by `turbo.json`, not by the build script.** `packages/database`'s `build` is `tsc` alone. Putting `prisma generate &&` back into it would run it twice and let Turbo cache a `dist` built from generated sources it does not track, then restore that cache into a tree where the gitignored `src/generated/` is absent.

**`pnpm-workspace.yaml` has an `onlyBuiltDependencies` allowlist.** pnpm 10+ blocks dependency build scripts by default, so without it `pnpm install` *succeeds* while leaving Prisma ungenerated and argon2 without a native binary. Add to this list when introducing a dependency that needs a postinstall step.

**`ConfigModule`'s `envFilePath` is anchored to `__dirname`, not a relative string.** cwd differs between `turbo dev` (cwd = `apps/backend`) and `pnpm --filter @expense-tracker/backend start:prod` from the root.

**Money is `Decimal(12, 2)` in Postgres and a `string` over JSON.** `ExpenseDto.amount` is typed `string` on purpose — Prisma serializes Decimal to a string to avoid float drift. Parse only at the display boundary (`apps/frontend/src/lib/format.ts`); arithmetic on it elsewhere silently produces wrong money. Service layer converts input with `.toFixed(2)` rather than passing raw JS numbers to Prisma.

**Build failures inside `packages/database/src/generated/` are not user code.** The Prisma client ships as TypeScript source and compiles under our `strict` config; `skipLibCheck` does not apply because these are `.ts`, not `.d.ts`. Never edit those files — `pnpm db:generate` overwrites them.

## Conventions

- Every query and mutation is scoped by `userId`. Deletes use `deleteMany({ where: { id, userId } })` and check `count === 0` rather than `delete` + ownership lookup, so one user cannot touch another's rows. `ExpensesService.assertCategoryBelongsToUser` exists for the same reason.
- `@expense-tracker/eslint-config` exports `base` and `nest` only. Next's rules are composed in `apps/frontend/eslint.config.mjs` directly from `eslint-config-next`, which is version-locked to Next and would otherwise couple every package's lint to the frontend's framework version.
- Route paths come from `API_ROUTES` in `packages/shared`, so a rename on one side is a type error on the other.
- Auth is a bearer token in `localStorage`, no refresh rotation, no rate limiting — deliberate learning-template simplifications documented in the README, not oversights to silently "fix."
