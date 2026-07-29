# CI Second-Layer Quality Gates

Follow-up to `2026-07-29-github-actions-quality-gates.md`, which delivered the first two jobs in
commit `aa6274a` (PR #4). This plan closes the gaps that gate left open.

## Current-State Analysis

| Rank | Finding                                                                                                                                                                                                             | Confidence | Evidence                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | Backend e2e never runs in CI. It is the only check that catches a CQRS handler missing from a module's `providers` — `CqrsModule` discovers handlers at `onApplicationBootstrap`, so `tsc` cannot see the omission. | High       | `apps/backend/test/app.e2e-spec.ts:50-55`; `apps/backend/package.json` (`test` = `jest`, `rootDir: "src"`) |
| 2    | `schema.prisma` can be edited without a migration and merge green. Every existing check reads the datamodel; none compares it to `prisma/migrations/`.                                                              | High       | `.github/workflows/ci.yml` (no database, no drift step)                                                    |
| 3    | No dependency or workflow surface guard: no `dependabot.yml`, no workflow linting, no audit.                                                                                                                        | High       | `.github/` contained only `workflows/{ci,claude,claude-code-review}.yml`                                   |
| 4    | No coverage instrumentation. The backend's `collectCoverageFrom` / `coverageDirectory` have never been invoked, and `@vitest/coverage-v8` was absent.                                                               | High       | `apps/backend/package.json` (no `test:cov` script); frontend devDependencies                               |
| 5    | `claude-code-review.yml` has no concurrency group and no `if:`, so a five-push PR runs five overlapping reviews and the first four are wasted.                                                                      | High       | `.github/workflows/claude-code-review.yml:3-21`                                                            |
| 6    | The existing placeholder `DATABASE_URL` is already `ci:ci@localhost:5432/ci`, which a Postgres service container can serve verbatim.                                                                                | High       | `.github/workflows/ci.yml:21`                                                                              |

## Reproduced Findings

These four were run against the repository, not inferred. Three contradict the obvious approach.

**`--from-migrations` is unusable here.**

```
$ prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code
Error: You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts` if you want to diff a migrations directory.
```

There is no `--shadow-database-url` flag in v7; the only channel is committed config. Adding one to
`prisma.config.ts` would be a production change serving a CI-only need.

**The shadow-free form works and asserts more.** Run _after_ `prisma migrate deploy`, it compares the
database the migrations actually produced against the datamodel:

```
$ prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
No difference detected.        # exit 0
```

**Prisma 7 renamed the flags.** It is `--from-schema` / `--to-schema`, **not** the v6
`--from-schema-datamodel` / `--to-schema-datamodel` that every tutorial still shows. Verified against
`prisma migrate diff --help` in this repo.

**The dotenv precedence gotcha is a non-issue.** `prisma.config.ts` loads `../../.env` then `.env`
with `override: false`, and dotenv never overwrites an already-set `process.env` key regardless.
`.env` is gitignored, so no file exists on a runner. A CI-set `DATABASE_URL` wins either way — no
change to `prisma.config.ts` is needed.

Supporting facts: `turbo.json`'s `globalPassThroughEnv` already lists `DATABASE_URL` and
`JWT_SECRET`. `AuthModule` and `JwtStrategy` both call `config.getOrThrow("JWT_SECRET")`, so
`AppModule` cannot boot without it. `coverage/` is already gitignored and already exempt from oxfmt.
The e2e spec imports `@expense-tracker/database` as built `dist/`, so the job needs `^build`, not
merely `db:generate`.

## Implementation Changes

### 1. `turbo.json` — two new tasks

```json
"test:e2e": {
  "dependsOn": ["^build", "db:generate"],
  "cache": false
},
"test:cov": {
  "dependsOn": ["^build", "db:generate"],
  "outputs": ["coverage/**"]
}
```

**`cache: false` on `test:e2e` is load-bearing.** The task's result depends on a live database Turbo
does not track as an input, so a cached pass would be replayed against a database that may no longer
have the migrations applied. `test:cov` is deterministic and caches normally.

### 2. Root scripts

`"test:e2e": "turbo run test:e2e"` and `"test:cov": "turbo run test:cov"` in the root
`package.json`; `test:cov` added to both workspaces (`jest --coverage`, `vitest run --coverage`).
Contributors get the same one-liner CI uses.

### 3. `.github/workflows/ci.yml` — two new jobs

**`End-to-end tests`** with a `postgres:17-alpine` service whose `POSTGRES_USER`,
`POSTGRES_PASSWORD` and `POSTGRES_DB` are all `ci`, matching the workflow-level `DATABASE_URL`
exactly — changing one without the other breaks this job alone. `options:` mirrors the `pg_isready`
healthcheck in `docker-compose.yml`; without it the first `migrate deploy` races initdb. Job-level
`JWT_SECRET` because `AppModule` cannot boot without it.

Step order is `pnpm db:deploy` → drift check → `pnpm test:e2e`. `migrate deploy` needs no generated
client, and `test:e2e` pulls in `^build` and `db:generate` through the Turbo task. `pnpm db:seed` is
**not** required — the spec registers `e2e-${Date.now()}@example.com` and deletes it.

```yaml
- name: Check for migration drift
  run: >-
    pnpm --filter @expense-tracker/database exec prisma migrate diff
    --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

The drift check lives inside this job rather than standalone because it needs a database built from
`prisma/migrations` and nothing else — which the previous step already produced. A standalone job
would need its own service, install, and deploy to recreate existing state.

**`Coverage report`** runs `pnpm test:cov` then `node scripts/coverage-summary.mjs`.

An `actionlint` step folds into the existing **Lint and static quality** job rather than becoming a
new job, so it reuses the checkout and adds no new required check name.

### 4. `scripts/coverage-summary.mjs`

Reads the `json-summary` output from both runners and writes one markdown table to
`$GITHUB_STEP_SUMMARY`. It reads the JSON rather than scraping the `text` reporter because
`pnpm test:cov` interleaves two workspaces through Turbo and the combined stdout has no stable shape
to slice. A missing summary file renders as a dash instead of failing the job. Backend Jest needed
`"coverageReporters": ["text", "json-summary"]` added; the frontend declares it in `vitest.config.ts`.

### 5. `.github/dependabot.yml`

Weekly `npm` and `github-actions` ecosystems, grouped by dependency type. Ungrouped, a tree this size
opens enough weekly PRs that people stop reading them, which is worse than not updating.

- `ignore` covers `typescript >=7` (`ts-jest` declares `>=4.3 <7`) and `@types/node >=25` (tracks the
  Node 24 runtime in `.nvmrc`). Both pins are deliberate and documented in the root `CLAUDE.md`.
- `commit-message: { prefix: chore, include: scope }`, because Dependabot's default
  `Bump x from a to b` is not a Conventional Commit and the repository requires one.
- `cooldown: { default-days: 7 }`, because pnpm 11 enforces a minimum release age — the auto-written
  `minimumReleaseAgeExclude` block in `pnpm-workspace.yaml` is the evidence. Without a matching
  cooldown Dependabot can propose a version too young for pnpm to resolve.

### 6. `.github/workflows/audit.yml`

`pnpm audit --audit-level=high` on a weekly `schedule` plus `workflow_dispatch`. **Deliberately not
on pull requests**: a newly published advisory against a transitive dependency with no upstream fix
would turn every open PR red for a reason unrelated to its diff, and the only remedies are
`--audit-level` inflation or an ignore-list that rots. A weekly run surfaces the same information as
something one person acts on.

### 7. Turbo cache

`actions/cache@v4` on `.turbo/cache` in all four jobs. Cache entries are immutable, so the key
carries `github.sha` or it is written once and never refreshed; `restore-keys` then pulls the most
recent prefix match. Keyed per `github.job` because each job runs a different task set and a shared
key would have them overwriting each other's entries.

Not Turbo remote caching: it needs `TURBO_TOKEN`/`TURBO_TEAM` secrets and an external account for a
build already under two minutes.

### 8. `claude-code-review.yml` and `claude.yml`

Concurrency group keyed on the PR number with `cancel-in-progress`, plus
`if: draft == false && user.login != 'dependabot[bot]'`. `timeout-minutes` added to both Claude
workflows, which otherwise inherit the six-hour default.

### 9. Documentation

`README.md`, `.claude/.docs/developer-guide.md`, the root `CLAUDE.md`/`AGENTS.md` **pair**, the
`apps/backend/{CLAUDE,AGENTS}.md` pair, and `.claude/skills/commit/SKILL.md` — the last because it
told contributors CI does not run backend e2e, which stopped being true.

## Repository Interface

- New required check name: **`End-to-end tests`**. Same contract as the existing two — once branch
  protection references it, a rename does not fail loudly; the old check simply stops reporting and
  every PR blocks forever on one that no longer exists.
- **`Coverage report` is deliberately not a required check.** Neither runner declares a threshold.
- New root scripts `pnpm test:e2e` and `pnpm test:cov`.
- **Never gate a required job behind a job-level `if:` or a `paths:` filter.** A skipped job reports
  as pending, indistinguishable from one still running.

## Verification and Acceptance

Run locally before pushing; all of the following were confirmed:

- `pnpm format:check` clean. **oxfmt formats YAML and markdown**, so `ci.yml`, `dependabot.yml` and
  `audit.yml` are checked by the job they configure. The first attempt failed on markdown table
  alignment in `README.md` and `developer-guide.md` — the gate doing its job.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass.
- `pnpm test:e2e` passes — **8 cases**, not 9.
- `pnpm test:cov` passes. Measured baseline: **backend 96.27%, frontend 95.22% statements**. This is
  why no threshold was set — the number to defend was unknown when the gate was designed, and
  guessing produces either a no-op or a gate that fails on unrelated PRs.
- `actionlint` v1.7.7 exits 0 against all four workflows.
- Dependabot's `cooldown`, `groups`, `ignore` and `commit-message` keys checked against GitHub's
  options reference.
- **The drift check was proven to fail, not just to pass.** A scratch `driftProbe String?` column
  added to `Category` produced exit `2` and `[*] Changed the categories table / [+] Added column
driftProbe`; reverting returned exit `0`. A gate only ever observed passing is not known to work.

Remaining, on the first GitHub run: the Postgres service reports healthy before `migrate deploy`;
four jobs start; the coverage job posts a step summary and does not block; the install log contains
no `ERR_PNPM_IGNORED_BUILDS` (the repository's documented silent-failure mode, where install reports
success while Prisma has no engines and argon2 no native binary).

## Manual Follow-Up (not a repository change)

**The whole change is inert without this.** Update the `main` ruleset to require
`Lint and static quality`, `Tests and build`, and `End-to-end tests`. Check names appear in GitHub's
picker only after a run has reported them, so this comes after the first merge to `main`. Requires
admin.

On a single-maintainer repository: keep required approvals at **0** and leave "Require review from
Code Owners" **off** — GitHub does not let an author approve their own pull request, and either
setting makes every PR unmergeable.

## Assumptions and Risks

- **Coverage is reported, not enforced**, per the scope decision. A weak PR can still land untested
  code; the e2e job and review are what catch it. Revisit once several runs of summary data exist —
  a global floor a few points under the measured baseline, `lines` and `statements` only. Not
  per-file, which turns every new file into a test-the-getter exercise.
- **PR hygiene gates were explicitly out of scope** and remain unbuilt: Conventional-Commits linting
  of PR title and commit subjects, the `CLAUDE.md`/`AGENTS.md` changed-together check, a PR template,
  and CODEOWNERS. Worth noting the pairs are **not** byte-identical by design (the `CLAUDE.md` copies
  say "Claude Code (claude.ai/code)" where `AGENTS.md` says "coding agents"), so only "changed
  together" is a valid invariant — never content equality.
- The repository merges with merge commits, not squash. Should commit-message linting land later, it
  must lint `git log --no-merges <base>..<head>`: the PR title never enters history, and the 29
  pre-`2134288` commits plus the GitHub-authored merge subjects do not conform.
- **CodeQL**, if wanted, should be enabled through GitHub's default setup rather than a committed
  workflow — same analysis, no YAML to maintain. Keep it out of required checks until it has a clean
  baseline.
- `zizmor` would flag `anthropics/claude-code-action@v1` as a mutable tag. The blast radius is small:
  `ci.yml` is `permissions: contents: read`, and the Claude workflows use `pull_request` rather than
  `pull_request_target`, so fork PRs receive no secrets. Worth one manual run, not a recurring job —
  a permanently `continue-on-error` job is one nobody reads.
