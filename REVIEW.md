# REVIEW.md

Rules for reviewing code in this repository — human or agent. The authoritative statements of _why_
each rule exists live in `CLAUDE.md`, `apps/backend/CLAUDE.md`, and `apps/frontend/CLAUDE.md`; this
file is the checklist, not a second source of truth. If a rule here ever contradicts those, they win
and this file is the thing to fix.

Reviews are written in English regardless of the language of the request, the branch, or the PR
description — see **Output language** in the root `CLAUDE.md`.

## What a review covers

A review looks at the branch diff against `main`, not the whole repository. Pre-existing problems
outside the diff are worth a note at most; they are never blocking for someone else's branch.

Before commenting on style, confirm the mechanical checks:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

`pnpm test` runs backend Jest and frontend Vitest but **deliberately excludes backend e2e**, which
needs Postgres up and migrated. A branch touching `apps/backend/test/` should say whether
`pnpm --filter @expense-tracker/backend test:e2e` was run; a reviewer should not assume it was.

On a fresh clone nothing typechecks until `pnpm install && pnpm db:generate` have run, because the
generated Prisma client is gitignored. A wall of unresolved imports at that point is a setup state,
not a finding.

## Severity

Three levels, and every finding gets one:

- **Blocking** — the change is wrong, unsafe, or breaks a load-bearing invariant listed below.
  Correctness, data scoping, money handling, auth behaviour, guidance desynchronization.
- **Should fix** — real but not dangerous: a missed convention, a gap in tests, an unclear name that
  will cost the next reader time. Author decides whether it lands in this branch or the next.
- **Nit** — taste. Say so explicitly and do not block on it.

Anchor every finding to `file_path:line` and state the failure it causes, not just the rule it
violates. "This is not the convention" is weaker feedback than "an out-of-range `page` renders one
blank frame before the clamp lands."

## Blockers that are easy to miss

### Repository-wide

- **`AGENTS.md` and `CLAUDE.md` are edited in the same commit, always** — root, `apps/backend/`, and
  `apps/frontend/`. A diff that touches one file of a pair and not the other is blocking. A rule
  belongs in the workspace file when it only makes sense inside that workspace, in the root file when
  it spans more than one, and in exactly one of the two levels — never duplicated into both.
- **Commit messages follow Conventional Commits.** Nothing enforces this: `.husky/pre-commit` runs
  `lint-staged` only, so there is no `commit-msg` hook to catch a malformed header. Do not use
  `git log` as the style reference — history predating the rule is mostly sentence-case subjects.
- **Feature work does not land on `main` directly.** Branches are `<type>/<short-kebab-case>` and
  short-lived.
- **`packages/database` never becomes a frontend dependency.** The frontend talks HTTP and imports
  types from `packages/shared`. This is what keeps the generated Prisma client on a single CommonJS
  consumer; adding the import breaks that for good. Missing type → add it to `packages/shared`.
- **Money is a `string` end to end.** `Decimal(12, 2)` in Postgres, `string` over JSON, parsed only at
  the display boundary in `apps/frontend/src/lib/format.ts`. Arithmetic anywhere else is blocking
  even when the test passes — float drift is silent. Service-layer input goes through `.toFixed(2)`
  rather than a raw JS number.
- **Validation rules stay on `class-validator` DTOs; `packages/shared` holds shapes.** A `@Min` or
  `@MaxLength` mirrored into the shared package is a finding, and so is a filter added to
  `TransactionQuery` without the matching field on `FindTransactionsQueryDto`.
- **Route paths come from `API_ROUTES`.** A hand-written string literal for a route is blocking; it
  turns a rename from a type error into a runtime 404.
- **`totalPages` is `Math.ceil(totalItems / pageSize)`, so it is `0` for an empty result set.** Any
  pager rendered from a truthiness check instead of `totalPages > 1` is a defect.
- **Never edit `packages/database/src/generated/`.** `pnpm db:generate` overwrites it. Build errors
  originating there are not user code.

### Backend (`apps/backend`)

- **Every query and mutation is scoped by `userId`.** Deletes use
  `deleteMany({ where: { id, userId } })` and check `count === 0`; a `delete` plus a separate
  ownership lookup is blocking. Anything accepting a `categoryId` from the client goes through
  `TransactionsService.assertCategoryBelongsToUser`.
- **A uniqueness check inside an update excludes the row being edited** —
  `if (existing && existing.id !== id)`. The naive form answers 409 for a save that renamed nothing.
- **Partial updates use `...(dto.x !== undefined && { x: dto.x })`**, so `undefined` leaves the column
  alone and `null` clears it. Nullable fields are declared `string | null` on the **create** DTO;
  widening `UpdateCategoryDto` alone is a finding.
- **A new command or query handler is registered in `USERS_COMMAND_HANDLERS` /
  `USERS_QUERY_HANDLERS`.** `tsc` cannot see the omission — it surfaces at runtime as
  `CommandHandlerNotFoundException`. Expect `users.cqrs.spec.ts` to be extended alongside the message.
- **`AuthModule` reaches users only through the buses.** `exports: [UsersService]` appearing in
  `UsersModule` is blocking; add a command or query instead. (This boundary is scoped to users —
  `CategoriesService` and `TransactionsService` inject `PrismaService` directly on purpose.)
- **New bus messages carrying secrets are flagged for redaction.** Plaintext passwords ride on
  `RegisterUserCommand`, `ChangeUserPasswordCommand`, `DeleteUserCommand`,
  `ResetUserPasswordCommand`, and `VerifyUserCredentialsQuery`; `ResetUserPasswordCommand` also
  carries a live single-use `token`. The in-memory publisher discards them, so any logging or tracing
  publisher added in a diff must redact — that is blocking in the same PR that adds it.
- **Hand-written Swagger schemas drift.** A field added to `TransactionDto` also goes into
  `TRANSACTION_SCHEMA`; the paginated envelope lives in `common/swagger/`. Endpoints returning a
  decorated DTO class need neither.
- **Constructor and `@Body()` parameters use value imports.** `typescript/consistent-type-imports` is
  off here because its autofix erases the `emitDecoratorMetadata` Nest's DI reads at runtime. An
  `import type` on an injected class is blocking regardless of what the linter says.
- **Emoji fields are validated by grapheme count (`IsSingleEmoji`), never `@MaxLength`.**
  `"👨‍👩‍👧‍👦".length === 11`, so any length cap rejects real emoji.

### Frontend (`apps/frontend`)

- **Any category mutation invalidates `["transactions"]` as well as `["categories"]`.**
  `TransactionDto` embeds a snapshot of its category, so the single invalidation leaves the table
  showing a stale name or colour.
- **Every paginated list query sets `placeholderData: keepPreviousData`.** Without it, an unseen key
  resolves to `data: undefined`, blanking the table and unmounting the pager the reader just clicked
  — taking keyboard focus with it. `page` is clamped **during render**, not in an effect, so an
  out-of-range page is never painted.
- **URL query parameters are untrusted input.** `readTransactionQuery` in `lib/transaction-filters.ts`
  validates each one down to something the API accepts and drops the rest; forwarding a hand-typed
  value straight to the API earns a 400.
- **There is exactly one handler per way a session ends.** Voluntary goes through `useLogout()`;
  involuntary is `api-client` → `authStorage.expire()` → the hard navigation in `Providers`. A
  per-page "on 401, redirect" effect is blocking — the global handler already fired and the two only
  race. `AppShell` owns the no-token-at-all redirect and nothing else.
- **`apiClient.patch` takes an `unknown` body.** Match the DTO: `undefined` omits, `null` clears, and
  only where the backend declares `string | null`.
- **No caller-supplied `id` on a Radix `Dialog.Content`.** Caller props spread last, so it overwrites
  the generated id and leaves the trigger's `aria-controls` pointing at nothing.

## Things that are not findings

Raising these as defects is itself the mistake — they are decided, documented, and deliberate:

- Bearer token in `localStorage`, no refresh rotation, no rate limiting. Learning-template
  simplifications recorded in the README.
- Jest on the backend and Vitest on the frontend. Two runners on purpose, not drift.
- No jsdom and no testing-library on the frontend; coverage is scoped to `src/lib/**/*.spec.ts`. Adding
  component tests is its own decision, not a drive-by in an unrelated branch.
- shadcn/ui under `src/app/{login,forgot-password,reset-password,terms,privacy}` while `/categories`
  and `/transactions` keep hand-written Tailwind. Do not propose migrating either side to match.
- TypeScript pinned to `^5.9.3` (`ts-jest` declares `typescript: ">=4.3 <7"`) and `@types/node` on
  `^24.x` tracking the Node 24 runtime. "Dependency is out of date" is not a finding here.
- `datasource` with no `url`, `moduleFormat = "cjs"`, and `createPrismaClient()` instead of
  `new PrismaClient()`. Prisma 7 requires all three.
- `prisma generate` living in `turbo.json` rather than in the `build` script.
- `allowBuilds` in `pnpm-workspace.yaml` — pnpm 11's key, not pnpm 10's `onlyBuiltDependencies`. A new
  dependency with a postinstall step **does** need an entry added, and that is a finding.
- The hand-written `RENAME COLUMN` migration, and hand-edited SQL under
  `packages/database/prisma/migrations` generally — `.oxfmtrc.jsonc` exempts that directory.
- The Russian doc comment on `PasswordResetToken.tokenHash` in `schema.prisma`. It is a dated record
  of a past decision and stays as written; quote it verbatim rather than translating it.
- `PasswordResetToken.tokenHash` being SHA-256 next to argon2 `passwordHash`. Deterministic hashing is
  what lets the column be `@unique` and found in one indexed lookup.
- Existing commit messages that predate the Conventional Commits rule. Follow the spec going forward;
  leave published history alone.

## Reviewer checklist

Work top to bottom. Skip a section only when the diff does not touch that area — never because it
looks fine at a glance. Each line maps to a rule stated above; go read it before filing the finding.

**Setup**

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` all pass on the branch.
- [ ] Backend e2e was run, or the PR says it was not (`pnpm --filter @expense-tracker/backend test:e2e`).
- [ ] Branch is `<type>/<short-kebab-case>`, based on `main`, scoped to one coherent change.
- [ ] Commit messages are Conventional Commits — nothing enforces this, so it is on the reviewer.
- [ ] Everything produced is in English: code, comments, docs, commit messages, PR description.

**Always**

- [ ] `AGENTS.md` and `CLAUDE.md` moved together for every pair the diff touches; the rule sits at one level, not both.
- [ ] No `@expense-tracker/database` import reached the frontend; missing types went to `packages/shared`.
- [ ] Money stayed a `string` outside `apps/frontend/src/lib/format.ts`; service input went through `.toFixed(2)`.
- [ ] Validation rules stayed on `class-validator` DTOs; `packages/shared` gained shapes only, and both sides of `TransactionQuery` / `FindTransactionsQueryDto` moved together.
- [ ] Routes came from `API_ROUTES`, not string literals.
- [ ] Any new pager renders from `totalPages > 1`, not a truthiness check.
- [ ] `packages/database/src/generated/` is untouched.
- [ ] New behaviour is covered by a test, and no `TODO`, `test.skip`, `test.only`, or empty test body landed.

**Backend, if touched**

- [ ] Every new query and mutation is scoped by `userId`; deletes use `deleteMany` + `count === 0`; a client-supplied `categoryId` is ownership-checked.
- [ ] Uniqueness checks inside an update exclude the edited row.
- [ ] Partial updates use the `...(dto.x !== undefined && { x: dto.x })` spread, with nullable fields declared on the create DTO.
- [ ] New CQRS handlers are in `USERS_COMMAND_HANDLERS` / `USERS_QUERY_HANDLERS`, with `users.cqrs.spec.ts` extended.
- [ ] `UsersModule` still has no `exports`; cross-module access went through a command or query.
- [ ] New bus messages carrying a password or reset token are accounted for, and any new publisher redacts them.
- [ ] Fields added to `TransactionDto` also landed in `TRANSACTION_SCHEMA` / the paginated envelope schema.
- [ ] Injected classes and `@Body()` parameters use value imports, never `import type`.
- [ ] New emoji fields validate by grapheme count, not `@MaxLength`.

**Frontend, if touched**

- [ ] Category mutations invalidate `["transactions"]` alongside `["categories"]`.
- [ ] New paginated queries set `placeholderData: keepPreviousData`, and `page` is clamped during render.
- [ ] New URL query parameters are validated in `lib/transaction-filters.ts` before reaching the API.
- [ ] No per-page 401 redirect was added; voluntary logout still goes through `useLogout()`.
- [ ] `apiClient.patch` bodies match the DTO — `undefined` omits, `null` only where the backend declares `string | null`.
- [ ] No caller-supplied `id` on a Radix `Dialog.Content`.
- [ ] The shadcn split was respected: no drive-by migration of `/categories` or `/transactions`.

**Database and tooling, if touched**

- [ ] A column rename is a hand-written `RENAME COLUMN` migration, not a generated drop-and-add.
- [ ] A new dependency with a postinstall step has an `allowBuilds` entry in `pnpm-workspace.yaml`.
- [ ] A schema change was followed through `packages/shared` and both apps, not just the model.

**Before submitting**

- [ ] Every finding carries a severity, a `file:line`, and a concrete failure — not just a rule name.
- [ ] Nothing on the "not findings" list was raised as a defect.
- [ ] Findings outside the diff are marked as notes, not blockers.

## Evidence, not assertion

A review claim about behaviour is checked before it is written. Read the surrounding file rather than
the diff hunk alone — this codebase hides its reasons in the neighbouring lines and in the three
`CLAUDE.md` files. If a finding cannot be stated as a concrete failure ("inputs X → wrong output Y"),
it is a nit at best.

Placeholder work is blocking and is never evidence of completion: `TODO` stubs, `test.skip`,
`test.only`, empty test bodies, and unimplemented branches. Either the branch implements them or the
PR says plainly what was left out.

## Skip review

- Generated migrations files in prisma/migrations/*
- Changes in *.lock files
