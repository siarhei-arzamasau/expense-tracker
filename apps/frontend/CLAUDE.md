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

Two kinds of spec live here, and `vitest.config.ts` collects both from `src/**`. Pure functions under
`src/lib` stay on the default `environment: "node"`. Component specs are `*.spec.tsx` beside the
component and opt into jsdom per file with a `// @vitest-environment jsdom` docblock on the first
line — omit it and the spec fails with `document is not defined` rather than skipping quietly.

Two settings in that config are load-bearing. `oxc.jsx` must be set because the Next.js tsconfig says
`jsx: "preserve"`, which Vite refuses to parse ("content contains invalid JS syntax"); it belongs
under `oxc` rather than `esbuild`, since Vite 8 announces that it is ignoring the esbuild half. And
`vitest.setup.ts` registers the `@testing-library/jest-dom` matchers plus `afterEach(cleanup)`,
because React Testing Library only auto-cleans when Vitest runs with `globals: true` and this project
keeps globals off.

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
(`src/lib/format.ts`). Arithmetic on it anywhere else silently produces wrong money. This is why the
dashboard's summary bars are drawn from `flowShares()` in that file rather than from a ratio computed
in the page — a `Number()` call in a component is one the next person reuses for a figure that really
is shown as currency.

## Design system

**The visual language lives in `src/app/globals.css` and nowhere else.** A warm paper canvas, white
panels floating on it, three pastel tints that carry the money semantics, and one near-black ink
spent sparingly — on the primary button, the sidebar account card, and the icon badges.

- **The tokens are the shadcn/ui names repointed at this palette**, so `shadcn add <component>` still
  produces something that matches. Reach for `bg-card`, `text-muted-foreground`, `bg-secondary`
  rather than a literal colour; a hex in a component is a bug.
- **The money tints are semantic, not decorative.** `income` / `balance` / `expense` and their
  `-ink` foregrounds mean exactly what they are named, and each pastel-and-ink pair is picked to
  clear 4.5:1. Do not reuse `bg-expense` because it is a nice orange.
- **Two faces, two jobs.** `font-display` (Outfit) carries the wordmark, headings and every money
  figure; Manrope is the default and runs the interface text. `h1`–`h3` pick up `font-display` in the
  base layer, so a heading does not need the class.
- **Two component classes carry the repeated structure**: `.panel` is a floating white surface and
  `.eyebrow` is the small tracked capitals used for section labels and table headers. Both live in
  `globals.css` — add the third one there rather than re-typing its utilities.
- **Controls are pill-shaped.** Buttons, inputs, selects, tabs and the pager are all `rounded-full`;
  surfaces are `rounded-panel` or `rounded-2xl`. A `rounded-md` control is off-system.
- **Inputs are filled rather than outlined**, and grow a border only on focus. Six outlined boxes in
  a row is the look this replaced.

`AppShell` owns the canvas padding, and the sidebar's `sticky` offset and height are derived from it.
Change one without the other and the sidebar drifts out of alignment as the page scrolls.

## Constraints that look like mistakes but are not

**The shared primitives under `components/ui` are used app-wide; `Card` and `Form` are not.**
Buttons, inputs, alerts and tabs are shared by every route because the redesign put every control on
one system. `Card` and the `Form`/`FormField` wrapper stay on the pages that already used them —
`src/app/{login,forgot-password,reset-password,terms,privacy}` and `/profile` — while `/categories`
and `/transactions` keep hand-written Tailwind for their page-specific layout. Migrating those two to
`Card`/`Form` is still out of scope for anything but a task that asks for it (see
`2026-07-28-category-management.md`, which rejected it as scope creep).

**`next/font/google` is aliased away under Vitest.** Font loading is an SWC transform, not a runtime
module, so importing it under any other bundler throws "next/font requires SWC" and takes
`app/layout.spec.tsx` down with it. `vitest.config.ts` points the specifier at `vitest.next-font.ts`.
Add an export there when introducing another family — the alias does not generate them.

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
