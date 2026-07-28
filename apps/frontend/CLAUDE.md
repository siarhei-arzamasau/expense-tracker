# CLAUDE.md — frontend

This file provides guidance to Claude Code (claude.ai/code) when working in `apps/frontend`. The
repository-wide rules — output language, git branches, commit messages, workspace commands, and the
cross-cutting architecture decisions — live in the root `CLAUDE.md` and still apply here.

## Guidance synchronization

Keep `apps/frontend/AGENTS.md` and `apps/frontend/CLAUDE.md` synchronized. Whenever guidance is
added, changed, or removed in either file, apply the equivalent change to the other file in the same
task.

## Commands

```bash
pnpm --filter @expense-tracker/frontend build
pnpm --filter @expense-tracker/frontend test
pnpm --filter @expense-tracker/frontend exec vitest transaction-filters  # by file
```

**The frontend is Vitest**, because it is ESM and uses the Next.js `@/*` alias, which
`vitest.config.ts` re-declares. The backend uses Jest instead — that split is on purpose, not drift.

Coverage is scoped to `src/lib/**/*.spec.ts` — pure functions, `environment: "node"`, no DOM. There
is no jsdom and no testing-library; adding component tests is a deliberate decision, not a drive-by.

`pnpm dev` serves the app on :3000 against the backend on :3001.

## Architecture

**Never add `@expense-tracker/database` as a frontend dependency.** The frontend talks to the backend
over HTTP and imports types from `packages/shared`; if a type is missing, add it there. The reasoning
is in the root `CLAUDE.md` — the generated Prisma client having exactly one runtime consumer is what
lets it stay CommonJS.

**Zod is used for `react-hook-form` and nowhere else.** Request and response shapes come from
`packages/shared`; the authoritative validation rules live on the backend's `class-validator` DTOs and
are not mirrored here.

**Money arrives as a `string` and is parsed only at the display boundary**
(`src/lib/format.ts`). Arithmetic on it anywhere else silently produces wrong money.

## Constraints that look like mistakes but are not

**shadcn/ui is installed but only used under `src/app/{login,forgot-password,reset-password,terms,privacy}`.**
`/categories` and `/transactions` stay on their pre-existing hand-written Tailwind classes — that split
is intentional (see `2026-07-28-category-management.md`, which rejected installing shadcn for that
feature as scope creep, and `2026-07-28-auth-pages.md`, where the auth pages' own requirement asked
for shadcn components). Don't "clean up" the inconsistency by migrating one side to match the other
outside of a task that asks for it.

**Never pass your own `id` to a Radix `Dialog.Content`.** Radix generates one, points the trigger's
`aria-controls` at it, and spreads caller props _last_ — so your id silently wins and leaves that
`aria-controls` addressing an element that no longer exists, which is worse for a screen reader than
having written nothing. The same ordering is why `aria-describedby={undefined}` is the supported way
to say "this dialog has no description" (`app-shell.tsx`).

**`totalPages` is `Math.ceil(totalItems / pageSize)` and is therefore 0, not 1, for an empty result
set.** Render the pager from `totalPages > 1`, never from a truthiness check.

## Conventions

- Any category mutation must invalidate `["transactions"]` as well as `["categories"]` (`src/app/(app)/categories/page.tsx`). `TransactionDto` carries a snapshot of its category, so without the second invalidation a renamed or recoloured category keeps rendering stale in the transactions table.
- Transaction description, type, and category filters are server-side and page-aware. Their state lives in `/transactions` URL query parameters; changing a filter returns to page 1. Because that state is the address bar, it is untrusted input: `readTransactionQuery` in `lib/transaction-filters.ts` validates every parameter down to something the API accepts and drops the rest, rather than forwarding a hand-typed `?type=TRANSFER` and earning a 400. Category-name search remains client-side because the full category collection is already cached.
- Any paginated list query sets `placeholderData: keepPreviousData`. Paging and filtering change the query key, and an unseen key resolves to `data: undefined` — which blanks the table _and_ unmounts the pager the reader just clicked, taking keyboard focus with it. `page` also has to be clamped when `totalPages` shrinks beneath it; the dashboard does this during render rather than in an effect, so the out-of-range page is never painted (Oxlint's `no-set-state-in-effect` will reject the effect form anyway).
- Auth is a bearer token in `localStorage`, no refresh rotation, no rate limiting — deliberate learning-template simplifications documented in the README, not oversights to silently "fix." The protected shell waits for `GET /auth/me` before rendering account content.
- **Sessions end two ways and there is exactly one handler for each.** Voluntary — the logout buttons, account deletion — goes through `useLogout()` (`lib/use-logout.ts`): clear the token, clear the query cache, `router.replace("/login")`. Involuntary is any 401 on an authenticated request, which `api-client` turns into `authStorage.expire()`; `Providers` answers that event with a full `window.location.replace`, because an expired token can surface from anywhere and only a hard navigation reliably tears down what was mid-flight. Do not add a per-page "on 401, redirect" effect — the global handler already fired and the two only race each other. `AppShell` owns one redirect and only one: no token at all, where no request was ever made for anything to notice.
- Route paths come from `API_ROUTES` in `packages/shared`, so a rename on one side is a type error on the other.
- `apiClient.patch` takes an `unknown` body, which will happily send a `null` the backend DTO does not admit. Match the DTO: `undefined` omits a field, `null` clears one, and only where the backend declares `string | null`.
