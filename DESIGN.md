# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-07-28
- Primary product surfaces: authenticated dashboard, transactions, categories, profile, and public account/authentication pages.
- Evidence reviewed: `.claude/.plans/2026-07-28-frontend-homepage.md`, the existing auth and category plans, `README.md`, `apps/frontend/src/app`, `apps/frontend/src/components`, `apps/frontend/src/app/globals.css`, and shared API types/routes.

This file is the design contract for the expense-tracker interface. Implementations and reviews should update it when a product decision changes instead of introducing an undocumented parallel pattern.

## Brand

- Personality: calm, direct, practical, and trustworthy; a focused personal tool rather than a financial trading product.
- Trust signals: exact money formatting, explicit account identity, predictable navigation, clear pending/error/success states, and confirmation around destructive actions.
- Avoid: decorative gradients, dashboard clutter, unexplained color, gamification, chart-heavy reporting without a user need, and finance jargon.

## Product goals

- Goals: make the current monthly position immediately legible; make transaction capture fast; make full history searchable; keep account/category management discoverable.
- Non-goals: budgets, charts, historical comparisons, multi-currency conversion, transaction editing/deletion, refresh-token infrastructure, or a new design-system dependency.
- Success signals: a signed-in user can understand the month, add a transaction, find an older transaction, manage categories, and manage the account without leaving the protected shell.

## Personas and jobs

- Primary persona: an individual tracking everyday income and expenses. This is an explicit product assumption based on the single-user-scoped data model and seeded demo account.
- User jobs: check this month's balance; record income/expense; find transactions; organize categories; update identity/security; leave or delete the account safely.
- Key contexts of use: quick mobile capture and scanning, plus wider desktop review and account management.

## Information architecture

- Primary navigation: Dashboard, Transactions, Categories, Profile, and Logout.
- Core routes/screens: `/`, `/transactions`, `/categories`, and `/profile` inside the protected shell; `/login`, password-reset, terms, and privacy outside it.
- Content hierarchy: current-month summary and primary Add action; recent/history list; page/filter controls; supporting management flows.

## Design principles

- Put the current financial state and next likely action first.
- Keep the interface quiet: structure comes from spacing, type, borders, and neutral surfaces; semantic color is limited to categories and income/expense meaning.
- Reuse behavior across routes: one shell, transaction list, paginator, loading treatment, and error/empty-state language.
- Make state explicit. Never present failed summary data as zero or silently disable a failed action.
- Tradeoff: the protected shell waits for a client token check and `GET /auth/me`, avoiding account-content flash while retaining the learning template's localStorage auth model.

## Visual language

- Color: use the neutral CSS variables in `apps/frontend/src/app/globals.css`; green supports income, rose/destructive supports expense or irreversible actions, and category color remains user data.
- Typography: system stack; `text-2xl` page titles, `text-lg` sections, `text-sm` body/actions, and `text-muted-foreground` supporting copy.
- Spacing/layout rhythm: `gap-4` within regions, `gap-6` or `gap-8` between page sections, readable max-width content, and full-width tables where needed.
- Shape/radius/elevation: bordered `rounded-lg`/`rounded-xl` surfaces; shadows only for elevated dialogs/drawers.
- Motion: functional transitions and loading pulse only; no decorative animation.
- Imagery/iconography: Lucide icons at 16–20px; icons support text and require accessible labels when text is absent. Category emoji/color is user-owned imagery.

## Components

- Existing components to reuse: Button, Input, PasswordInput, Alert, Card, Form, Tabs, and existing category form patterns.
- New/changed components: protected AppShell, AddTransactionDialog, TransactionList, TransactionPagination, and shared transaction/current-user query helpers.
- Variants and states: desktop table/mobile cards; loading skeleton, retryable error, unfiltered empty, filtered empty, disabled no-category creation, and destructive profile action.
- Token/component ownership: global visual tokens remain in `globals.css`; reusable primitives remain under `components/ui`; domain behavior belongs under `components/transactions` or its route.

## Accessibility

- Target standard: WCAG 2.2 AA for core flows.
- Keyboard/focus behavior: visible focus, semantic buttons/links, Radix focus trapping/restoration for dialog and mobile menu, Escape dismissal, and labelled close controls.
- Contrast/readability: use theme token foreground/background pairs; never communicate transaction type or validation by color alone.
- Screen-reader semantics: `aria-current` for active navigation, labelled regions/tables/pagination, live/status or alert semantics for asynchronous feedback, and labels for every form control.
- Reduced motion and sensory considerations: no meaning depends on animation; loading pulse is supplementary to accessible busy/loading text.

## Responsive behavior

- Supported breakpoints/devices: modern mobile and desktop browsers; `md` is the main navigation/list presentation boundary.
- Layout adaptations: fixed 256px sidebar on desktop; sticky header plus modal drawer on mobile; transaction table on desktop and compact cards on mobile.
- Touch/hover differences: mobile actions use labelled tap targets; hover styles supplement rather than replace active/focus state.

## Interaction states

- Loading: shape-preserving skeletons for summaries, lists, and category-dependent actions; protected content waits for identity.
- Empty: distinguish no account transactions from no matches for active filters; no-category creation links to category management.
- Error: show the API message when safe, retain page context, bound automatic retries, and offer an explicit retry action.
- Success: close/reset transaction creation; update visible identity after profile edits; show concise profile/password confirmation.
- Disabled: explain why submission/action is unavailable; pending actions prevent duplicate submission.
- Offline/slow network: no offline mode; bounded retry followed by an actionable error state.

## Content voice

- Tone: concise, plain English, supportive without celebration or blame.
- Terminology: “transaction,” “income,” “expense,” “category,” “balance,” and “profile” match the domain/API.
- Microcopy rules: name the failed action, state the recovery action, use ellipses for pending button labels, and describe irreversible deletion consequences directly.

## Implementation constraints

- Framework/styling system: Next.js App Router, React, Tailwind v4, existing shadcn/Radix primitives where already appropriate, TanStack Query, React Hook Form/Zod, and Lucide; add no dependency for this system.
- Design-token constraints: extend the current neutral theme rather than creating route-specific palettes or a second token layer.
- Performance constraints: server pagination is fixed at 10 records; filters execute on the backend; query keys isolate pages/filters and mutations invalidate only affected families.
- Compatibility constraints: browser code imports shared HTTP types/routes, never Prisma/database; money stays a decimal string until formatting; transaction dates display as UTC calendar days.
- Test/screenshot expectations: typecheck, lint, unit tests, format check, production build, backend e2e where a database is available, and seeded browser smoke when a browser runtime is available.

## Open questions

- [ ] Define a formal supported-browser matrix if this template moves beyond learning/demo use — Product/Engineering; affects compatibility and visual-regression coverage, not the current feature.
