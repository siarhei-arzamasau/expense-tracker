# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

Workspace-specific guidance lives next to the code it governs:

- `apps/backend/AGENTS.md` — NestJS, Prisma access, CQRS, DTOs, Swagger, Jest.
- `apps/frontend/AGENTS.md` — Next.js, React Query, filters and paging, auth session handling, Vitest.

What stays here is what is true across the whole repository.

## Guidance synchronization

Keep `AGENTS.md` and `CLAUDE.md` synchronized. Whenever guidance is added, changed, or removed in either file, apply the equivalent change to the other file in the same task. This applies to every pair in the repository: the root files, `apps/backend/{AGENTS,CLAUDE}.md`, and `apps/frontend/{AGENTS,CLAUDE}.md`.

Put a rule in the workspace file when it only makes sense inside that workspace, and here when it spans more than one. Do not duplicate a rule into both levels.

## Output language

**Everything you produce is in English, whatever language the request arrives in.** Plans, code, comments, commit messages, documentation, PR descriptions, and chat replies — all English, including when the prompt, an issue, or a pasted spec is in other languages. Translate rather than mirror the input language.

Two things this rule does not do. It does not ask you to rewrite existing Russian text you happen to read — the `PasswordResetToken.tokenHash` doc comment in `schema.prisma` is in Russian and stays that way, because it is a dated record of a past decision; a plan or doc quoting a schema comment quotes it verbatim rather than translating it, so that the quote keeps matching the code. And it does not apply to user-facing product strings, which follow whatever the feature requires.

## Git branches and commits

Branching (GitHub Flow) and commit message rules (Conventional Commits 1.0.0) live in
`.claude/skills/commit/SKILL.md` — plain markdown, readable without Claude Code skill support.
Read it before creating a branch, writing a commit message, or opening a pull request; it is the
single source of truth for both, so add changes there rather than restating them here.

There is also a vendored `git-commit` skill at `.claude/skills/git-commit/SKILL.md` — generic
Conventional Commits background from `github/awesome-copilot`, kept as reference only. **It is not an
alternative entry point**, and its own preamble defers to `commit`. It has no branching step, so
following it would commit feature work straight to `main`, and it is silent on this repo's no-tool-attribution
override. If the two ever conflict in practice, fix `git-commit` or delete it — never `commit`.

## Code review

Reviews happen in two places and they are complementary. **In CI**, every non-draft pull request from
a non-bot author triggers `.github/workflows/claude-code-review.yml`, which runs
`/code-review:code-review` against the PR — nothing to invoke by hand. **Locally, before pushing**,
`.claude/skills/requesting-code-review/SKILL.md` describes dispatching a reviewer subagent over a git
range — plain markdown, readable without Claude Code skill support — which is the cheaper place to
catch a problem.

Base the range on `git merge-base origin/main HEAD`, not `HEAD~1` — a branch here usually carries
several commits. And pass the reviewer the "Project Context" block from that skill's
`code-reviewer.md`: it receives crafted context rather than session history, so without it the same
documented decisions (no rate limiting, bearer token in `localStorage`) get reported as Critical
findings on every single review.

## Project state

Expense tracker: Turborepo + pnpm workspaces, Next.js 16 frontend, NestJS 11 backend, PostgreSQL 17 via Prisma 7.

Installed and verified: `typecheck`, `lint`, `build`, `test`, and `format:check` all pass. On a **fresh clone** nothing typechecks until `pnpm install` + `pnpm db:generate` have run, because the generated Prisma client is gitignored — a wall of unresolved imports at that point is expected, not a bug.

```bash
nvm use && cp .env.example .env      # Node 24.18.0
pnpm install
docker compose up -d                  # Postgres 17 on :5432, DBHub MCP on :8080
pnpm db:generate && pnpm db:migrate && pnpm db:seed
```

## Commands

Run from the repo root; Turborepo fans out in dependency order.

| Command                                                     | Notes                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                                                  | frontend :3000, backend :3001, Swagger at :3001/api/docs |
| `pnpm build` / `pnpm typecheck` / `pnpm lint`               | whole workspace                                          |
| `pnpm format` / `pnpm format:check` / `pnpm lint:fix`       | Oxfmt write/check and safe Oxlint fixes                  |
| `pnpm test`                                                 | backend Jest specs and frontend Vitest specs             |
| `pnpm test:e2e`                                             | backend e2e; needs Postgres running and migrated         |
| `pnpm test:cov`                                             | both runners with coverage; no threshold is enforced     |
| `pnpm db:migrate` / `db:generate` / `db:seed` / `db:studio` | proxied to `packages/database`                           |

Scoping to one package uses `pnpm --filter <name> <script>`, e.g. `pnpm --filter @expense-tracker/backend build`. Running a single test differs per workspace — see the workspace `AGENTS.md` files.

**The two workspaces use different runners on purpose**: Jest on the backend, Vitest on the frontend. `pnpm test` deliberately excludes backend e2e, which needs Postgres running and migrated — that is what `pnpm test:e2e` is for, and CI runs it in its own job against a service container.

**The `test:e2e` Turbo task sets `cache: false`, and that is load-bearing.** Its result depends on a live database Turbo does not track as an input, so a cached pass would be replayed against a database that may no longer have the migrations applied.

Seeded login: `demo@example.com` / `password123`.

## Continuous integration

`.github/workflows/ci.yml` gates pull requests into `main` and pushes to `main` with four jobs: **Lint and static quality** (`format:check`, `actionlint`, `lint`, `typecheck`), **Tests and build** (`test`, `build`), **End-to-end tests** (Postgres service, `db:deploy`, migration-drift check, `test:e2e`), and **Coverage report**. No secrets.

`.github/workflows/dependency-review.yml` runs on every pull request and rejects dependency changes that introduce high- or critical-severity vulnerabilities. **The first three CI job names and the `Dependency review` job name are public API.** Once the `main` ruleset requires them, a rename does not fail loudly — the old required check just stops reporting and every PR blocks forever on a check that no longer exists. **Coverage report is deliberately not a required check**: neither runner declares a threshold, so it records numbers rather than gating on them.

GitHub CodeQL default setup scans JavaScript/TypeScript, and repository-level secret scanning plus push protection are enabled. The `main` ruleset must require the four named checks above, block high- or critical-severity CodeQL findings, require up-to-date pull requests and resolved conversations, and block force-pushes and branch deletion. Renovate never bypasses these gates.

**The migration-drift check is why `schema.prisma` cannot be edited without a migration.** After `prisma migrate deploy` builds the CI database from `prisma/migrations` alone, `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` compares that database to the datamodel; a non-empty diff exits 2. Note Prisma 7 removed `--to-schema-datamodel` — the flag is `--to-schema`, and the connection URL comes from `prisma.config.ts`. The `--from-migrations` form is not usable here: it demands a `datasource.shadowDatabaseUrl` in committed config for a CI-only need.

`.github/workflows/audit.yml` runs `pnpm audit --audit-level=high` weekly, **not on pull requests** — a new advisory against a transitive dependency would otherwise turn every open PR red for a reason unrelated to its diff.

Dependency version updates are managed by the Mend Renovate GitHub App using the root `renovate.json`. Regular npm releases wait seven days; major updates need Dependency Dashboard approval; only development patch updates and weekly lockfile maintenance may automerge, and only after required checks pass. GitHub Dependabot alerts stay enabled as Renovate's advisory source, but Dependabot version and security-update PRs stay disabled to avoid duplicate bots.

The workflow sets a `DATABASE_URL` at the workflow level, and **every** job needs it: `lint` and `test` each depend on `^build`, and `packages/database`'s build depends on `db:generate`, which aborts without the variable even though it never opens a connection. It was a placeholder until the e2e job made it real — the Postgres service sets `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` to match `ci:ci@localhost:5432/ci` exactly, so changing one without the other breaks that job alone. Node comes from `.nvmrc` and pnpm from `packageManager` — never restate either version in the workflow. `pnpm/action-setup` must run before `actions/setup-node`, because `cache: pnpm` shells out to `pnpm` to find the store.

**Never gate a required job behind a job-level `if:` or a `paths:` filter.** A skipped job reports as pending, not passing, and is indistinguishable from one still running — every PR then blocks forever.

All GitHub Actions are pinned to full commit SHAs and carry version comments that Renovate maintains. Oxfmt formats YAML and JSON, so run `pnpm format:check` after editing workflows or `renovate.json`.

## Architecture

**Dependency direction is the load-bearing decision.** `packages/database` is a dependency of `apps/backend` **only** — never the frontend. The frontend talks to the backend over HTTP and imports types from `packages/shared`. This gives the generated Prisma client exactly one runtime consumer (NestJS, CommonJS), which is why `schema.prisma` can set `moduleFormat = "cjs"` and sidestep the ESM/CJS dual-format problem entirely. Do not add `@expense-tracker/database` to the frontend; add the type to `packages/shared` instead.

**`packages/database` and `packages/shared` compile to `dist/` via `tsc`** and are consumed as built output, not source. `nest build` only compiles its own `rootDir`, so the consume-as-source pattern would not work here.

**Validation rules live in NestJS `class-validator` DTOs; `packages/shared` holds the request and response _shapes_ plus the route constants.** Zod is used on the frontend for `react-hook-form` and nowhere else. The distinction is rules versus shapes: `CreateTransactionInput` and `TransactionQuery` describe what a request looks like and belong in `packages/shared`, while `@Min`, `@MaxLength` and `@IsUUID` stay on the DTO and are never mirrored there. `FindTransactionsQueryDto implements TransactionQuery` is what makes the pairing load-bearing — drop a filter on one side and `tsc` fails on the other.

**`PaginatedResponse<T>` lives in `packages/shared/src/types/pagination.ts`, not beside `TransactionDto`.** It is the envelope for every paginated endpoint, so the second one should not have to import a transaction module to describe its own response. `totalPages` is `Math.ceil(totalItems / pageSize)` and is therefore **0**, not 1, for an empty result set — render the pager from `totalPages > 1`, never from a truthiness check.

## Constraints that look like mistakes but are not

**TypeScript is pinned to `^5.9.3` while `latest` is 7.x.** `ts-jest` declares
`typescript: ">=4.3 <7"`, so TypeScript 7 is excluded by the test toolchain. Do not bump to 7
until `ts-jest` supports it. Same reasoning for `@types/node ^24.13.3` rather than 26.x — it
tracks the Node 24 runtime.

**`turbo/no-undeclared-env-vars` is the one rule that does not run as a native Oxlint rule.**
`oxlint.config.ts` loads `eslint-plugin-turbo` through Oxlint's alpha JavaScript-plugin bridge.
Keep the dependency and expect bridge compatibility to need verification on upgrades.

**Oxlint type-aware linting is disabled repository-wide.** The backend additionally turns off
`typescript/consistent-type-imports` for a NestJS-specific reason — see `apps/backend/AGENTS.md`.

**Prisma 7 differs from every v6 tutorial in three ways.** The `datasource` block has no `url` — connection URLs live in `packages/database/prisma.config.ts`. Prisma no longer auto-loads `.env`, and a bare `import "dotenv/config"` is insufficient because the CLI's cwd is `packages/database` while `.env` is at the repo root; `prisma.config.ts` resolves it explicitly. And **`new PrismaClient()` with no options throws** — v7 requires a driver adapter. Go through `createPrismaClient()` / `createPgAdapter()` in `packages/database/src/client.ts`, which is the single place `@prisma/adapter-pg` is wired; `PrismaService` passes the adapter via `super()`. The generator sets `output`, `moduleFormat`, and `importFileExtension` explicitly because the latter two otherwise default to "inferred from environment."

**`prisma generate` is owned by `turbo.json`, not by the build script.** `packages/database`'s `build` is `tsc` alone. Putting `prisma generate &&` back into it would run it twice and let Turbo cache a `dist` built from generated sources it does not track, then restore that cache into a tree where the gitignored `src/generated/` is absent.

**`pnpm-workspace.yaml` uses `allowBuilds` (a map), NOT pnpm 10's `onlyBuiltDependencies` (a list).** pnpm 11 renamed it and silently ignores the old key, so an install that should have been gated instead _reports success_ while leaving Prisma without engines and argon2 without a native binary. The tell is `ERR_PNPM_IGNORED_BUILDS` in the install output. Add an entry here when introducing a dependency with a postinstall step.

**Money is `Decimal(12, 2)` in Postgres and a `string` over JSON.** `TransactionDto.amount` is typed `string` on purpose — Prisma serializes Decimal to a string to avoid float drift. Parse only at the display boundary (`apps/frontend/src/lib/format.ts`); arithmetic on it elsewhere silently produces wrong money. The service layer converts input with `.toFixed(2)` rather than passing raw JS numbers to Prisma.

**`20260728035150_rename_password_to_password_hash/migration.sql` is hand-written, and column renames generally have to be.** `prisma migrate dev` renders a rename as `DROP COLUMN` + `ADD COLUMN`, which destroys every stored hash, and then refuses to run at all because the environment is non-interactive and it wants confirmation for the data loss. The file contains `ALTER TABLE "users" RENAME COLUMN` instead, applied with `prisma migrate deploy`. `.oxfmtrc.jsonc` exempts `packages/database/prisma/migrations`, so hand-edited SQL stays as written.

**Build failures inside `packages/database/src/generated/` are not user code.** The Prisma client ships as TypeScript source and compiles under our `strict` config; `skipLibCheck` does not apply because these are `.ts`, not `.d.ts`. Never edit those files — `pnpm db:generate` overwrites them.

## Conventions

- Formatting and linting policy lives at the repository root in `.oxfmtrc.jsonc` and
  `oxlint.config.ts`; package scripts should keep calling `oxlint .` so filtered linting works.
- Route paths come from `API_ROUTES` in `packages/shared`, so a rename on one side is a type error on the other.
- Adding a column to a model ripples through `schema.prisma`, `packages/shared`, and both apps. `tsc` will say so, but expect more than one file.
- Auth is a bearer token in `localStorage`, no refresh rotation, no rate limiting — deliberate learning-template simplifications documented in the README, not oversights to silently "fix."

## Updating docs

When adding functionality, check the documentation in @.claude/.docs/* and update it.
