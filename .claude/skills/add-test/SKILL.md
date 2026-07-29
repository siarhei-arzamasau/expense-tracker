---
name: add-test
description: Add a test for a file in this repository — picks the right runner and location, writes the case in the house style, and proves it can fail. Use whenever asked to add, write, or extend a test, spec, or unit test here.
model: sonnet
allowed-tools: Bash(pnpm:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Write, Edit, Grep, Glob
argument-hint: [file] [what to cover, optional]
---

# Add a test

- $0 - the file to test
- $1 - what the test should cover

- **First argument — the file.** Required. Either a source file or a spec file; step 1 resolves
  which.
- **Second argument — what to cover.** Optional free text. Without it, step 4 picks the case from
  what the file does and what is already covered.

This skill writes a test and runs it. It stops there. It never commits, never pushes, and — the rule
that matters most — **never edits the code under test**. See step 6.

## 1. Resolve the target

```bash
git status --short --branch
ls <dir>/<basename>.spec.ts     # does the sibling spec already exist?
```

A `*.spec.ts` argument is the spec to extend. Anything else is the source, and its spec is the
sibling `<name>.spec.ts` — open it if it exists, create it if it does not.

Four stop conditions. In each, report and stop rather than working around it:

- **The path is under `packages/`.** `packages/database`, `packages/shared`, and
  `packages/typescript-config` have no `test` script and no runner at all, so `turbo run test` skips
  them silently. A spec there means choosing and wiring a runner first, which is a decision and not a
  step. Say so — and note that most of what is worth testing in `packages/shared` is already
  exercised through the backend DTOs that implement its types.
- **The path is an `*.e2e-spec.ts`.** Different config (`test/jest-e2e.json`), different command
  (`pnpm --filter @expense-tracker/backend test:e2e`), and a live migrated Postgres
  (`docker compose up -d && pnpm db:migrate`). Not a blocker — but say up front that `pnpm test` does
  not run it, so a green `pnpm test` is not a claim about what you added.
- **The path does not exist.** Do not create it and do not guess at a near match; ask which file was
  meant.
- **The behavior is already covered.** Grep the spec before writing. A second test asserting what an
  existing one asserts is maintenance cost buying no coverage.

## 2. Pick the runner

**The two workspaces use different runners on purpose** — Jest on the backend because `ts-jest`
matches the CommonJS Nest compiles to, Vitest on the frontend because it is ESM with the Next.js
`@/*` alias. That split is not drift, and it decides how the file you are about to write starts.

|                   | `apps/backend`                                               | `apps/frontend`                                                     |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Runner            | Jest via `ts-jest`                                           | Vitest                                                              |
| Spec location     | beside the source, anywhere under `src/`                     | beside the source, anywhere under `src/`                            |
| DOM               | n/a                                                          | `// @vitest-environment jsdom` on line 1 of a `*.spec.tsx`          |
| `describe` / `it` | globals — **never imported**                                 | `import { describe, expect, it } from "vitest";`                    |
| Mocks             | `jest.fn()`                                                  | `vi.fn()`, imported from `"vitest"`                                 |
| One file          | `pnpm --filter @expense-tracker/backend exec jest <pattern>` | `pnpm --filter @expense-tracker/frontend exec vitest run <pattern>` |
| One test          | `... exec jest -t "<name>"`                                  | `... exec vitest run -t "<name>"`                                   |
| Type errors       | `ts-jest` type-checks as it runs                             | esbuild strips types — only `typecheck` sees them                   |

Four of those rows bite if you get them wrong:

- **The Vitest imports are mandatory.** `vitest.config.ts` does not set `globals: true`, so a
  frontend spec written in Jest's global style dies at `describe is not defined`. Both existing
  frontend specs open with that import line; match them.
- **`vitest run`, not bare `vitest`.** Bare `vitest` means watch mode, and whether it returns depends
  on the terminal: it degrades to a single run when stdin is not a TTY, and stays open watching when
  a human runs it interactively — which is the form `apps/frontend/CLAUDE.md` documents. `run` takes
  the ambiguity out and matches what the `test` script itself does.
- **`jest.fn()` does not exist under Vitest and `vi` does not exist under Jest.** Both have to be
  imported on the frontend, `vi` included.
- **A frontend component spec needs `// @vitest-environment jsdom` as its first line.** The default
  environment is `node`, which keeps the pure `src/lib` specs off a DOM they never touch. Omit the
  docblock and the spec fails with `document is not defined` — loudly, not silently. Two more things
  a component spec needs: React Query calls `mutationFn` with a second context argument (`{ client }`),
  so `toHaveBeenCalledWith(input)` never matches and you assert argument one instead; and a page that
  renders the same control in two places (an add form and an edit form) needs every query scoped with
  `within(...)`, or `getByRole` throws "found multiple elements" the moment both are open.
  `src/app/(app)/categories/page.spec.tsx` is the worked example.

## 3. Read before you write

Read three things, in this order:

1. **The source.** Every branch, and which of them a caller can actually reach.
2. **The sibling spec, or the nearest one.** The file you are editing sets the style — its builders,
   its mock shape, its naming. `transactions.service.spec.ts` is the fullest backend example,
   `transaction-filters.spec.ts` the fullest frontend one for pure functions, and
   `src/app/(app)/categories/page.spec.tsx` the one to copy for a component.
3. **The constraints.** The "Constraints that look like mistakes but are not" sections of the root
   `CLAUDE.md` and the workspace one. These are the standing list of things this codebase gets wrong
   when someone is not paying attention, which makes them the highest-value things to pin down.

## 4. Choose what to assert

**Cover the branch that is easy to get wrong, not the one that is easy to write.** The existing specs
are the guide to what this repository considers worth a test, and every one of them is a documented
constraint rather than a happy path: money keeping its trailing zeros (`82.40`, not `82.4`),
`totalPages` being 0 rather than 1 for an empty page, a query scoped to `where: { userId }`, a
hand-typed `?type=TRANSFER` being dropped instead of forwarded, `GET /auth/me` answering 401 and not
404 for a deleted user.

- **Assert behavior. Assert a call only when the call _is_ the contract.**
  `toHaveBeenCalledWith({ where: { userId: USER_ID } })` is legitimate because that scoping is the
  security property, and `expect.objectContaining({ amount: "0.30" })` because handing Prisma a raw
  float is the exact bug being prevented. Asserting that a helper ran twice, when the return value
  already proves it, tests the implementation and breaks on the next refactor.
- **One behavior per `it`.** Variations of one behavior go through `it.each` with the label first —
  `["a missing parameter", null]` feeding `("falls back to page 1 for %s", (_label, value) => ...)`.
- **Fake at the narrowest edge that still exercises the code.** Prisma is a hand-written object of
  `jest.fn()`s (`createPrismaMock`), not a library. `auth.service.spec.ts` mocks the CQRS buses
  because it is about what `AuthService` does with the answers, and `users.cqrs.spec.ts` owns the
  routing — when a property is split across two specs like that, say which owns which in a comment.
- **Never let a test look like it proves more than it does.** The email-enumeration comment in
  `auth.service.spec.ts` is the model to copy: it names what the mocked version cannot show and
  points at the spec that actually shows it. That is a better answer than an assertion that passes
  for the wrong reason.

## 5. Write it in the house style

- **Name the case for the behavior, and include the reason when there is one.**
  `it("keeps trailing zeros — 82.40 must not serialize as '82.4'")`,
  `it("401s — not 404s — for a token naming a deleted user")`. **Never `should`** — the word does not
  appear in a single test name in this repository.
- **Group with a nested `describe` per method** once a spec covers more than one — `describe("findAll")`
  inside `describe("TransactionsService")`.
- **Comment the why, never the what.** A comment earns its place by recording the constraint that
  makes an assertion look deliberate instead of arbitrary.
- **Builders, not literals.** `transactionRow({ amount: decimal("82.40") })` beats a fresh object
  per case, and keeps the next case one argument long.
- **Prefer a stand-in that can fail.** `decimal()` in `transactions.service.spec.ts` exposes only
  `toFixed`, so a regression from `.toFixed(2)` to `.toString()` throws instead of quietly passing —
  a plain string would have swallowed it. Build fakes that way round.
- **Fixed dates, fixed ids.** `new Date("2026-07-01T12:00:00.000Z")` and the
  `018f0000-0000-7000-8000-...` id pattern. `Date.now()` or a random UUID inside an expectation is a
  flake waiting for a slow CI machine.
- **CQRS specs need `await moduleRef.init()`, not `compile()` alone.** `CqrsModule` discovers
  handlers in `onApplicationBootstrap`, which `compile()` never fires, so without it every
  `execute()` throws `CommandHandlerNotFoundException`. Pair it with
  `afterEach(() => moduleRef.close())`.
- **Value imports for anything Nest injects.** `typescript/consistent-type-imports` is off across the
  backend precisely so its autofix cannot erase the decorator metadata DI reads. `import type` stays
  fine for a type used only in an annotation, the way `auth.service.spec.ts` imports `UserDto`.
- **A new command or query handler means extending `users.cqrs.spec.ts` as well.** A handler missing
  from `USERS_COMMAND_HANDLERS` is invisible to `tsc` and surfaces only as a runtime exception; that
  spec is the only thing standing between a forgotten registration and production.
- **English, always**, including when the request or the code's existing comments arrive in another
  language.

## 6. Run it, then prove it can fail

```bash
pnpm --filter @expense-tracker/backend exec jest transactions.service
pnpm --filter @expense-tracker/frontend exec vitest run transaction-filters
```

**Green on the first run means nothing on its own.** A test written against code that already works
passes whether or not it asserts anything real, so make it fail once: invert the expected value, or
break the line of source it covers, confirm red, then restore. A test that stays green through a
deliberate break is not a test — find out why before you report it.

Then the checks the run itself does not cover:

```bash
pnpm --filter @expense-tracker/<workspace> typecheck
pnpm --filter @expense-tracker/<workspace> lint
pnpm --filter @expense-tracker/<workspace> test
```

`pnpm build` will not catch a broken spec — `tsconfig.build.json` excludes `**/*.spec.ts` — and on
the frontend neither will Vitest, which strips types without checking them. `typecheck` is the only
thing that does. Formatting is not worth a step: `lint-staged` runs Oxfmt over the file at commit
time.

Two things not to do:

- **Do not edit the code under test.** The task is a test. If it fails, you have found a bug, and
  that is the deliverable — report it with the failing output and let the user decide whether fixing
  it belongs in the same change. Silently patching the source turns a discovery into an invisible
  behavior change.
- **Do not weaken an assertion to reach green.** Loosening `toEqual` to `toMatchObject`, deleting the
  awkward case, or asserting the wrong value that the code happens to produce all convert a real
  failure into a silent one.

If a backend spec fails on unresolved `@expense-tracker/database` imports, the tree is not built:
`turbo run test` declares `db:generate` as a dependency, but `pnpm --filter ... exec jest` bypasses
Turbo. Run `pnpm install && pnpm db:generate` and try again.

## 7. Report

Say which file you touched, name the cases you added, and state what each one pins down. Then three
things that are easy to leave out and shouldn't be:

- **That you watched it fail**, and how you made it fail. This is the evidence that the test is real.
- **What is still uncovered.** Adding a case is not a coverage claim, and the branch you skipped is
  worth one sentence.
- **Any bug you found**, at the top, ahead of everything else.

Adding a test needs no documentation update — `.claude/.docs/` describes behavior, and a test does
not change behavior. The exception is a test that had to document a new workflow to exist at all, and
step 1's stop conditions mean you would have raised that with the user already.

Stop at the report. Staging and committing are the `commit` skill; opening a PR is the `pr` skill.
