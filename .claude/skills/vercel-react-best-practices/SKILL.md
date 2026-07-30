---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.
license: MIT
model: sonnet
allowed-tools: Bash(pnpm:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Write, Edit, Grep, Glob
argument-hint: [file or component to review, optional]
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains 70 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

## In this repository, read this before applying anything

The rules below are written for the full Next.js surface. This app uses a narrow slice of it, so the
stated priority order is **not** the priority order here.

**Stack (do not re-derive):** Next.js 16.2, React 19.2, TanStack Query v5, Tailwind v4 + shadcn/ui
primitives. `next.config.ts` sets only `reactStrictMode` and `transpilePackages`.

- **There is no SWR.** `client-swr-dedup` is the one rule whose *mechanism* does not exist here —
  translate it to TanStack Query, which already deduplicates by query key (two components calling
  `useQuery(categoriesQueryOptions)` share one request and one cache entry). Do not add SWR.
- **Priority 3, "Server-Side Performance", is mostly inapplicable.** There are no server actions
  (no `'use server'`), no route handlers (no `src/app/api`), and the only two server components are
  `/terms` and `/privacy`, which fetch nothing. Every data-touching route is a client component
  talking to the **NestJS backend over HTTP**. Server-side performance in this product lives in
  `apps/backend` (NestJS + Prisma) and is outside this skill's scope — do not go looking for RSC
  waterfalls in `apps/frontend`, and do not introduce RSC data fetching to satisfy a rule here
  (`packages/database` must never become a frontend dependency; see the root `CLAUDE.md`).
- **The `async-` waterfall rules still apply**, but to backend service methods and to client-side
  promise chains, not to RSC composition.
- **Some rules are already satisfied, and the reasons are documented.**
  `rerender-derived-state-no-effect` matches existing policy — the dashboard clamps an out-of-range
  page *during render* rather than in an effect, and Oxlint's `no-set-state-in-effect` enforces it.
  `bundle-dynamic-imports` is already applied to the emoji picker in `categories/page.tsx`.
- **Before rewriting icon imports for `bundle-barrel-imports`**, note that the local barrel
  `src/components/transactions/index.ts` re-exports four modules and is not the problem that rule
  describes, and that Next.js applies `optimizePackageImports` defaults to common icon packages —
  measure with `pnpm build` before churning imports.

**Performance changes must not regress the documented accessibility invariants.** Several patterns in
`apps/frontend/CLAUDE.md` look like redundant work and are not: `placeholderData: keepPreviousData` on
every paginated query exists because an unseen query key resolves to `data: undefined`, which unmounts
the pager mid-interaction and takes keyboard focus with it. Stripping it would read as a sensible
memory/render win and would reintroduce a fixed bug. When a rule here and `apps/frontend/CLAUDE.md`
disagree, `CLAUDE.md` wins; raise the conflict rather than silently optimizing.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- `async-cheap-condition-before-await` - Check cheap sync conditions before awaiting flags or remote values
- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-analyzable-paths` - Prefer statically analyzable import and file-system paths to avoid broad bundles and traces
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-auth-actions` - Authenticate server actions like API routes
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-dedup-props` - Avoid duplicate serialization in RSC props
- `server-hoist-static-io` - Hoist static I/O (fonts, logos) to module level
- `server-no-shared-module-state` - Avoid module-level mutable request state in RSC/SSR
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-parallel-nested-fetching` - Chain nested fetches per item in Promise.all
- `server-after-nonblocking` - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-memo-with-default-value` - Hoist default non-primitive props
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-simple-expression-in-memo` - Avoid memo for simple primitives
- `rerender-split-combined-hooks` - Split hooks with independent dependencies
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-deferred-value` - Defer expensive renders to keep input responsive
- `rerender-use-ref-transient-values` - Use refs for transient frequent values
- `rerender-no-inline-components` - Don't define components inside components

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state
- `rendering-resource-hints` - Use React DOM resource hints for preloading
- `rendering-script-defer-async` - Use defer or async on script tags

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability
- `js-flatmap-filter` - Use flatMap to map and filter in one pass
- `js-request-idle-callback` - Defer non-critical work to browser idle time

### 8. Advanced Patterns (LOW)

- `advanced-effect-event-deps` - Don't put `useEffectEvent` results in effect deps
- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

## How to Use

Read individual rule files for detailed explanations and code examples. Paths are repo-relative:

```
.claude/skills/vercel-react-best-practices/rules/async-parallel.md
.claude/skills/vercel-react-best-practices/rules/bundle-barrel-imports.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

All 70 rules listed above are present in `rules/`, one file per rule, named exactly as the rule id.

## Full Compiled Document

Upstream also ships a generated `AGENTS.md` — the same 70 rules concatenated with a table of contents
and auto-numbered headings. **It is deliberately not vendored here.** It is build output rather than
source (upstream's README labels it "Compiled output (generated)"), it duplicates `rules/` byte for
byte apart from heading numbers, and its filename would put a 108 KB third-party performance guide
among this repository's own `AGENTS.md` agent-guidance files, which tools discover by that exact name.

Read `rules/<rule-id>.md` instead — the index above is the table of contents. If you genuinely want
the single-file version, regenerate it from upstream (`pnpm build` in the upstream repo) rather than
committing it here.
