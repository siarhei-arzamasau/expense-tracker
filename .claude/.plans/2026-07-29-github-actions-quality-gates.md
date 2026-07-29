# GitHub Actions Quality Gates

## Current-State Analysis

| Rank | Finding                                                                                                                                                                 | Confidence | Evidence                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| 1    | No automated lint/test workflow exists; current workflows only support Claude review and issue interaction.                                                             | High       | `.github/workflows/claude-code-review.yml:1`, `.github/workflows/claude.yml:1`               |
| 2    | The root scripts already provide the required CI interface: formatting, linting, typechecking, tests, and build. Turbo handles dependency builds and Prisma generation. | High       | `package.json:12`, `turbo.json:14`                                                           |
| 3    | `pnpm test` is database-free by design; backend E2E remains a separate command requiring migrated PostgreSQL.                                                           | High       | `apps/backend/package.json` (`test` = `jest`, `test:e2e` = separate config), `turbo.json:41` |
| 4    | `prisma generate` fails without `DATABASE_URL`, so every job that touches Turbo needs it — including lint.                                                              | High       | Reproduced: `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`        |
| 5    | `oxfmt` checks YAML, so `pnpm format:check` will lint the new workflow file itself.                                                                                     | High       | Verified: `oxfmt --check .github/workflows/claude.yml` matches 1 file; commit `8e313e0`      |
| 6    | pnpm's version is already pinned by `packageManager`, and `pnpm/action-setup` treats its `version` input as optional when that field exists.                            | High       | `package.json:7` (`pnpm@11.15.1`); `pnpm/action-setup` README                                |

## Implementation Changes

### 1. Add `.github/workflows/ci.yml`

Triggered for pull requests targeting `main` and pushes to `main`. No path filters, so a required
check can never be skipped into a permanently-pending state.

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  # Never cancel a run on main: its result is the record for that commit.
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  # prisma.config.ts resolves DATABASE_URL eagerly via env(), so `prisma generate`
  # aborts without it. No database is contacted during generation, so any well-formed
  # URL works. Not a secret.
  DATABASE_URL: postgresql://ci:ci@localhost:5432/ci?schema=public
  # `pnpm install` runs the root `prepare` script; git hooks are pointless on a runner.
  HUSKY: 0

jobs:
  lint:
    name: Lint and static quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    name: Tests and build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # ... identical setup ...
      - run: pnpm test
      - run: pnpm build
```

### 2. Setup-step constraints that are load-bearing

- **Do not pass `version:` to `pnpm/action-setup`.** `package.json`'s `packageManager` field already
  pins `pnpm@11.15.1`, and the action reads it. Restating the version creates a second place to bump
  and a mismatch the action has to resolve.
- **`pnpm/action-setup` must run before `actions/setup-node`.** `cache: pnpm` shells out to `pnpm`
  to locate the store; reversing the order fails with `Unable to locate executable file: pnpm`.
- **`node-version-file: .nvmrc`**, never a literal version — `.nvmrc` (24.18.0) is the existing
  single source of truth.
- **`DATABASE_URL` belongs at the workflow level, not per-step.** Both jobs need it: root `lint` is
  `turbo run lint`, `lint` depends on `^build`, `packages/database`'s `build` depends on
  `db:generate`. The lint job therefore runs `prisma generate` too.
- No `NEXT_PUBLIC_API_URL` and no `apps/frontend/.env.local` are needed. `api-client.ts:5` falls back
  to `http://localhost:3001/api`; the baked-in value is irrelevant to a build-only gate.

### 3. Everything else stays as it is

Keep the existing Claude workflows, package scripts, Turbo configuration, and dependencies
unchanged. No application, schema, or shared-type changes.

### 4. Documentation

- `README.md` — extend the `## Common commands` area with a short CI section: what runs, on which
  triggers, and that backend E2E is excluded.
- `.claude/.docs/developer-guide.md` — same content near the existing commands table (`:135`) and
  the E2E note (`:157`).
- **Root `CLAUDE.md` and `AGENTS.md` must be updated as a pair.** The repository's synchronization
  rule is explicit, and the CI gate is exactly the kind of repo-wide fact that belongs at the root
  level rather than in a workspace file. Adding to one and not the other is a defect.

### 5. Manual follow-up (not a repository change)

After the first successful run on `main`, update the `main` ruleset to require both checks. The
check names only appear in GitHub's picker once a run has reported them, so this cannot be done
first. Requires admin on the repository.

## Repository Interface

- New repository-level contract: the job names **Lint and static quality** and **Tests and build**.
  Once branch protection references them, renaming a job does not fail loudly — the old required
  check simply never reports again and every PR blocks on a check that no longer exists. Treat these
  strings as public API.
- Backend E2E remains explicitly outside the initial required checks.

## Verification and Acceptance

- On a fresh runner, `pnpm install --frozen-lockfile` succeeds with Node `24.18.0` and pnpm
  `11.15.1`.
- **The install log contains no `ERR_PNPM_IGNORED_BUILDS`.** This is the repository's documented
  silent-failure mode: the install reports success while Prisma has no engines and argon2 has no
  native binary. A green install line is not sufficient evidence on its own.
- A pull request starts both jobs, and all five canonical commands run: `format:check`, `lint`,
  `typecheck`, `test`, `build`.
- A push to `main` reruns both jobs and is not cancelled by a concurrent run.
- The test job reports both Jest and Vitest results; it does not invoke `test:e2e` and needs no
  PostgreSQL service.
- A pending or failed required job blocks merging; both successful jobs unblock it.
- The workflow needs no repository secrets and leaves the working tree unchanged.
- **`ci.yml` itself must be oxfmt-clean before the first push.** `oxfmt` formats YAML, so the lint
  job runs `format:check` over the workflow that is running it — a badly formatted `ci.yml` fails its
  own gate. Run `pnpm format:check` locally against the workflow and documentation changes before
  delivery; the first GitHub-hosted run is then the clean-environment verification.

## Assumptions and Risks

- Selected scope is the full quality suite. E2E can land later as a separate PostgreSQL-backed gate;
  it would need a `services: postgres` block plus `pnpm db:deploy`, which is why it is not folded
  into these jobs.
- **Both jobs duplicate more than the install.** Each independently runs `^build` and `db:generate`
  for `packages/database` and `packages/shared`, because both `lint` and `test` declare that
  dependency in `turbo.json`. The pnpm-store cache covers the install half only. This is accepted:
  the packages are small, and two independently-readable gate results are worth more than the
  saved minute. If it becomes slow, the fix is Turbo remote caching or an `actions/cache` step on
  `.turbo` — not collapsing the jobs, which would cost the separate check names.
- `prisma generate` needing `DATABASE_URL` was confirmed by reproduction, not inferred:
  running it with `.env` absent fails with
  `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`, raised from
  `packages/database/prisma.config.ts` where `datasource.url` is `env("DATABASE_URL")`.
