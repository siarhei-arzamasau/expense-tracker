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

The `vercel-react-best-practices` skill at `.claude/skills/vercel-react-best-practices/SKILL.md` holds
70 React/Next.js performance rules, one file per rule under `rules/`. Read its "In this repository"
preamble first: this app is client components against an HTTP backend, so the whole server-side
category (server actions, route handlers, RSC waterfalls) does not apply, and its data-fetching rule
assumes SWR where we use TanStack Query. **A performance suggestion never overrides a documented
invariant** — `placeholderData: keepPreviousData` and the render-time page clamp below exist for
correctness and accessibility, and both look like removable overhead if you only read them as
performance.

## Design system

**The visual language lives in `src/app/globals.css` and nowhere else.** A warm paper canvas, white
panels floating on it, three pastel tints that carry the money semantics, and one near-black ink
spent sparingly — on the primary button, the sidebar account card, and the icon badges.

The `ui-ux-pro-max` skill at `.claude/skills/ui-ux-pro-max/SKILL.md` is a searchable local database of
UX guidelines, accessibility checks, and Next.js/shadcn/React stack advice — useful when designing or
reviewing UI here. **It is a source of UX rules, not of palettes.** Its `--design-system` mode emits
raw hex and its own token tables, which lose to this section every time; the skill's own "In this
repository" preamble says so. Never run its `--persist` flag, which would stand up a second source of
truth competing with `globals.css`.

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
- **Inputs are filled rather than outlined, but they still carry a border at rest.** The fill is what
  makes six fields in a row read as one form rather than six boxes, and that part of the intent
  stands. What could not stand is the fill being the _only_ thing marking the control: `bg-secondary`
  on a white card measures 1.11:1, so an empty input was invisible under SC 1.4.11, which wants 3:1
  for the boundary that identifies a control. `border-input` is now on at rest — on `Input`, on the
  four hand-written fields under `/transactions` and `/categories`, and on `Checkbox`, where an
  unchecked box has no other affordance at all. Focus is still the ring plus the fill going white;
  the border no longer changes, because it is already there.
- **Contrast is measured against the canvas, not against a white panel.** `--muted-foreground` lands
  on both and the canvas is the darker surface, so a value tuned on `bg-card` reads ~0.7 lower out on
  the page — which is how `#6e727a` passed at 4.83:1 on a panel while failing at 4.16:1 under the
  auth taglines. `#686c74` is the first value on that hue ramp clearing 4.5:1 on canvas, secondary
  and card alike. Text tokens carry no alpha for the same reason: `muted-foreground/80` on a filled
  input is 3.05:1.
- **`--input` answers to a ratio, not to taste.** It is the SC 1.4.11 boundary, so it has to clear
  3:1 against every surface a control sits on — the white card, the control's own `bg-secondary`
  fill, and the canvas. `#8c8983` is the lightest value on the warm-neutral ramp that clears all
  three (3.49 / 3.14 / 3.00); the previous `#ded9cf` was 1.41:1 on card. Repointing the palette means
  re-deriving it rather than picking something that looks right.
- **`focus-visible:ring-ring/70` is the one alpha that works in both themes.** `--ring` is near-black
  in light and a light grey in dark, so the same utility has to clear 3:1 (SC 1.4.11) from opposite
  directions: `/25` is 1.73:1 light, and `/55` still fails dark at 2.73:1. Every control pairs it
  with `outline-none`, so lowering it leaves keyboard users with no visible focus at all — a
  regression no screenshot review will catch.
- **`outline-none` obliges you to draw the ring yourself, including on things you did not think were
  focusable.** Radix gives `Tabs.Content` `tabIndex={0}` unconditionally, so the panel on `/login` is
  a real stop in the tab order between the trigger and the first field. It carried `outline-none`
  with no ring for exactly that reason — nobody expects a panel to take focus — and a keyboard user
  had no indication of where they were (SC 2.4.7). `outline-none` also suppresses the browser's own
  ring, which is what would otherwise have covered for it.

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

**A Radix dialog opened from state rather than from a `Dialog.Trigger` has to restore focus itself.**
Radix returns focus to the trigger on close; the category delete dialog is shared by every row and
opened by calling `setDeleting`, so there is no trigger and focus lands on `<body>` — dropping the
reader at the top of a list they were partway down. `categories/page.tsx` holds the clicked button in
a ref and puts focus back from `onCloseAutoFocus`. `add-transaction-dialog.tsx` needs none of that
because it has a real `Dialog.Trigger`.

**A route's page title comes from a sibling `layout.tsx`, never from the page.** Every route but
`/terms` and `/privacy` is a client component, and a client component cannot export `metadata` — so
`login/layout.tsx` and its six siblings exist for no other reason than to name their route, with the
root layout supplying the `%s · Expense Tracker` template that completes them. Deleting one fails
nothing loudly: the route falls back to the root default, and its tab, its history entry and its
screen reader page announcement all read "Expense Tracker" like every other route.
`src/app/route-titles.spec.ts` is the only thing that catches it.

**`(app)/layout.tsx` carries the object form of `title` because it has children, and that is
load-bearing.** A segment's `title` _replaces_ its parent's rather than merging with it, and a plain
string carries no `template` — so `title: "Dashboard"` named `/` correctly while silently stripping
`· Expense Tracker` from `/transactions`, `/categories` and `/profile`, the three routes nested
beneath it. Any layout that both names itself and has routes below it has to restate the template.
Asserting each `metadata.title` in isolation cannot see this, which is why `route-titles.spec.ts`
resolves the chain the way Next.js does and asserts the rendered string.

**A validation message has to be associated with its field, not merely rendered next to it.**
react-hook-form moves focus to the first invalid field on submit, and focus announces the field's
_name_ — so an unassociated message left a screen reader saying "Name, edit text" and never why the
form refused (SC 3.3.1), with nothing announced when it appeared (SC 4.1.3). Every field error pairs
`aria-invalid` and `aria-describedby` on the control with `role="alert"` and a matching `id` on the
message. Equally, **the message must not live inside a wrapping `<label>`**: a label that contains
both the control and the error folds the error into the field's accessible name, so the amount field
announced as "Amount Amount is required" and repeated it on every refocus. Explicit `htmlFor`/`id` is
why `add-transaction-dialog.tsx` no longer wraps.

**`FormControl` names only ids that exist.** shadcn's original always puts the description id in
`aria-describedby`, and no form in this app renders a `FormDescription` — so every field in the
product pointed at an element that was never there. `FormItem` scans its children for a
`FormDescription` and `FormControl` builds the attribute from what is actually present. Keep
`FormDescription` a direct child of `FormItem`; nested inside a wrapper it will not be seen.

**The `.emoji-picker-host` wrapper class exists only to win a cascade fight.** `emoji-picker-react`
ships `#858585` as its one text colour and derives the search placeholder, the category labels and
the preview caption from it — 3.69:1 on white, 3.41:1 on its own search field, so all three failed
SC 1.4.3. Repointing `--epr-text-color` fixes them together, but the library injects its stylesheet
at runtime, after `globals.css`, so a rule on `.EmojiPickerReact` alone loses the tie on order. The
extra ancestor wins on specificity instead of reaching for `!important`. The picker's
`aria-controls="epr-search-id"` still addresses an element it never renders; that one needs an
upstream fix and cannot be reached from CSS.

**`totalPages` is `Math.ceil(totalItems / pageSize)` and is therefore 0, not 1, for an empty result
set.** Render the pager from `totalPages > 1`, never from a truthiness check.

**The `AppShell` prefetch is not a duplicate of the queries the pages already run.** The shell
renders no children until `GET /auth/me` resolves, so a page's own `useQuery` cannot start before
that round trip finishes — the prefetch is the only thing making the two overlap. Delete it and every
cold load costs an extra round trip while nothing fails: no test, no type error, no console warning.
It works only while the prefetched key matches the key the page later reads, which is why the summary
goes through `currentMonthSummaryQueryOptions()` in `lib/queries/transactions.ts` instead of each side
deriving its own month and year — derive them twice and the keys drift, leaving a wasted request and
the waterfall exactly where it was. `/profile` reads none of the three and pays for them anyway; that
is the accepted cost of the routes that do.

**`src/app/icon.svg` holds hex literals, and that is the one place a hex is not a bug.** It is served
as its own document by the Next.js file convention, so it never sees `globals.css` and cannot read
`--primary`. Its `#15171b` and `#ffffff` are a hand-copy of `--primary` / `--primary-foreground`, and
its glyph is the same lucide `WalletCards` the `Wordmark` badge uses — repointing the palette means
editing this file by hand, because nothing in the build will tell you it drifted. It also fixes what
would otherwise be a `/favicon.ico` 404 on every route: the `<link rel="icon">` Next.js generates
from it is what stops the browser falling back to a file this app does not ship.

## Conventions

- Any category mutation must invalidate `["transactions"]` as well as `["categories"]` (`src/app/(app)/categories/page.tsx`). `TransactionDto` carries a snapshot of its category, so without the second invalidation a renamed or recoloured category keeps rendering stale in the transactions table.
- Transaction description, type, and category filters are server-side and page-aware. Their state lives in `/transactions` URL query parameters; changing a filter returns to page 1. Because that state is the address bar, it is untrusted input: `readTransactionQuery` in `lib/transaction-filters.ts` validates every parameter down to something the API accepts and drops the rest, rather than forwarding a hand-typed `?type=TRANSFER` and earning a 400. Category-name search remains client-side because the full category collection is already cached.
- Any paginated list query sets `placeholderData: keepPreviousData`. Paging and filtering change the query key, and an unseen key resolves to `data: undefined` — which blanks the table _and_ unmounts the pager the reader just clicked, taking keyboard focus with it. `page` also has to be clamped when `totalPages` shrinks beneath it; the dashboard does this during render rather than in an effect, so the out-of-range page is never painted (Oxlint's `no-set-state-in-effect` will reject the effect form anyway).
- Auth is a bearer token in `localStorage`, no refresh rotation, no rate limiting — deliberate learning-template simplifications documented in the README, not oversights to silently "fix." The protected shell waits for `GET /auth/me` before rendering account content — it does not wait before _requesting_ the rest, which is what the prefetch above is for. `authStorage.get()` is read during render and so holds the token in memory rather than touching synchronous `localStorage` each pass; every mutator keeps that copy in step, and a `storage` listener drops it when another tab writes the key, so a write that bypasses the mutators cannot leave this tab authorizing with a stale token.
- **Sessions end two ways and there is exactly one handler for each.** Voluntary — the logout buttons, account deletion — goes through `useLogout()` (`lib/use-logout.ts`): clear the token, clear the query cache, `router.replace("/login")`. Involuntary is any 401 on an authenticated request, which `api-client` turns into `authStorage.expire()`; `Providers` answers that event with a full `window.location.replace`, because an expired token can surface from anywhere and only a hard navigation reliably tears down what was mid-flight. Do not add a per-page "on 401, redirect" effect — the global handler already fired and the two only race each other. `AppShell` owns one redirect and only one: no token at all, where no request was ever made for anything to notice.
- Route paths come from `API_ROUTES` in `packages/shared`, so a rename on one side is a type error on the other.
- `apiClient.patch` takes an `unknown` body, which will happily send a `null` the backend DTO does not admit. Match the DTO: `undefined` omits a field, `null` clears one, and only where the backend declares `string | null`.
