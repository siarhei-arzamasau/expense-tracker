---
name: check-layout
description: Check the frontend layout in a real browser at desktop and mobile widths with Playwright MCP after a UI change — logs in, screenshots the affected routes at both viewports, and reports what broke. Use whenever asked to check the layout, verify responsive behavior, look at a frontend change in a browser, or confirm a page still renders on mobile.
model: sonnet
allowed-tools: ToolSearch, Bash(pnpm:*), Bash(curl:*), Bash(docker compose:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Read, Grep, Glob, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_resize, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_hover, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages, mcp__playwright__browser_wait_for, mcp__playwright__browser_close
argument-hint: [route or component, optional — defaults to whatever the working diff touched]
---

# Check the layout on desktop and mobile

- $0 - a route (`/transactions`) or a component path to check instead of the diff

This skill drives a real browser over the running app and reports what it sees. It changes no code —
see step 8. It is the check you run **after** a frontend change, not a substitute for one: Vitest
renders into jsdom, which has no layout engine at all, so no frontend spec in this repository can
fail because something overflowed, overlapped, or vanished at 390px.

## 1. Preconditions: the stack has to be up

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/docs
```

Both must answer. If :3000 is silent, start the dev server in the background
(`pnpm dev`, `run_in_background: true`) and poll :3000 until it answers — Next.js compiles the first
route on demand, so the first request after a cold start is slow, not broken. If :3001 is silent,
the frontend renders its shell and then every panel fills with "Could not load…" — that is a dead
backend, not a layout bug, and screenshotting it proves nothing.

If the backend is up but login fails in step 4, the database is the problem, not the app:

```bash
docker compose up -d && pnpm db:migrate && pnpm db:seed
```

**Check the dev server, never a production build.** Hydration mismatches — a whole class of bug a
layout change causes — are reported in the console in development and swallowed in production. The
dev overlay is the point.

## 2. Load the Playwright tools in one call

The `mcp__playwright__*` tools are deferred: their schemas are not in context, and calling one before
it is loaded fails with `InputValidationError`. Load the set in a **single** `ToolSearch` — one call
per tool wastes a round-trip each.

```
ToolSearch("select:mcp__playwright__browser_navigate,mcp__playwright__browser_resize,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_fill_form,mcp__playwright__browser_evaluate,mcp__playwright__browser_console_messages,mcp__playwright__browser_close")
```

Three of these have parameters that are easy to get wrong, and two of them are _required_ with no
sensible-looking default to fall back on:

- **`browser_take_screenshot` requires both `type` and `scale`.** Pass `type: "png"` and
  `scale: "css"`. `"device"` renders at the device pixel ratio, which doubles the image for nothing
  you are going to look at.
- **`browser_console_messages` requires `level`.** Pass `level: "error"`; the levels nest, so `info`
  returns every React and Next.js development log and buries the one line that matters.
- **Every `filename` you pass must start with `.playwright-mcp/`.** This is the one that bites. The
  server resolves a relative path against the _repository root_, not against its own output
  directory — so `filename: "mobile.png"` drops a PNG next to `package.json` and into `git status`,
  while the auto-generated name it uses when you omit `filename` lands in `.playwright-mcp/`, which
  `.gitignore:40` already ignores. Write the prefix yourself and the two agree.

Navigating also auto-writes a `page-*.yml` snapshot and a `console-*.log` into `.playwright-mcp/`
without being asked. That is expected and ignored; leave them.

## 3. Decide what to look at

Without an argument, the diff picks the routes:

```bash
git status --short
git diff --name-only
```

Map what changed to what to open. **Do not sweep all nine routes** — this is a post-change check, and
a nine-route sweep buries the one screenshot that would have shown the regression.

| Changed                           | Open                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `components/layout/app-shell.tsx` | all four app routes — it wraps every one of them              |
| `app/globals.css`                 | one app route and one auth route; tokens are global           |
| `components/ui/*`                 | every route that renders that primitive (grep for the import) |
| `components/auth/*`               | `/login`, and `/forgot-password` if the change is shared      |
| `components/transactions/*`       | `/` and `/transactions` — both render the list                |
| a single `app/**/page.tsx`        | that route alone                                              |

The routes: `/` (dashboard), `/transactions`, `/categories`, `/profile` are behind auth; `/login`,
`/forgot-password`, `/reset-password`, `/terms`, `/privacy` are public.

**There is no `/register` route.** `register-form.tsx` renders inside the **Register** tab on
`/login`, so a change to it is invisible until you click that tab. The same goes for anything in a
dialog — the add-transaction and category forms only exist on screen once their trigger is clicked.

**Both tab panels stay mounted, so scope every selector on `/login`.** The Register form's inputs are
in the DOM even while the Log in tab is showing, which makes `input[type="password"]` match three
elements and fail Playwright's strict mode outright. Target the distinguishing attribute instead —
`input[autocomplete="current-password"]` is the login field, `new-password` the two register ones —
or scope by role and accessible name. This is the browser-side twin of the `within(...)` rule in
`add-test`.

## 4. Log in before touching a protected route

**A fresh Playwright browser has an empty `localStorage`, and the token lives there.** `AppShell`
sees no token, redirects to `/login`, and a check that skipped this step screenshots the login page
four times and reports the dashboard as fine.

Navigate to `http://localhost:3000/login` and click **Log in**. That is the whole step —
`login-form.tsx:33` sets `defaultValues` to the seeded account, so the form arrives already filled
with `demo@example.com` / `password123` and typing them again is wasted calls. If a future change
drops those defaults, fall back to `browser_fill_form` on the Email and Password fields.

`browser_click` takes a CSS selector in `target`, so a preceding `browser_snapshot` is optional —
reach for it when a label is ambiguous, not by reflex.

Confirm the login landed before going further: the URL becomes `/` and the page shows the sidebar
with the "Expense Tracker" wordmark. Staying on `/login` with an error means the seed never ran — go
back to step 1.

Log in **once**. The session survives resizing and navigation within the same browser, so the login
belongs at the top of the run and not once per viewport.

## 5. The two viewports

`md` (768px) is the only breakpoint in this app that changes the _structure_ of a page rather than
its spacing. Pin one viewport clearly on each side of it.

| Pass    | Size     | What it puts on screen                                                                   |
| ------- | -------- | ---------------------------------------------------------------------------------------- |
| Desktop | 1440×900 | sticky sidebar (`hidden md:block`), transactions as a `<table>`, `lg:` grids             |
| Mobile  | 390×844  | mobile header + drawer (`md:hidden`), transactions as a card `<ul>`, single-column grids |

Resize **before** navigating. Tailwind breakpoints are pure CSS and reflow on resize, but React state
does not reset — a drawer left open at 390px is still open in the state when you resize to 1440,
where `md:hidden` merely hides it.

**768–1023px is a third state**, where the sidebar is already visible but `lg:` spacing and the
three-column dashboard grid are not. It is worth one extra pass only when the diff touches grid
columns or the shell's padding; otherwise skip it.

**The mobile pass has to open the drawer.** The navigation below `md` is behind the
`Open navigation menu` button — click it, screenshot the open drawer, and close it with
`Close navigation menu` before moving on. A mobile check that never opened it tested none of the
mobile navigation.

**Watch for the two-rendering trap.** `transaction-list.tsx` renders the same transactions twice: a
`<table>` for `md:block` and a `<ul>` of cards for `md:hidden`. `AppShell` does the same with
`Navigation` and `AccountCard`, once in the sidebar and once in the drawer. A change applied to one
branch and not the other is invisible in the viewport you happened to look at first, which is exactly
what this skill exists to catch.

## 6. What to check at each viewport

Four things per route per viewport. The first two are mechanical and should be run, not eyeballed.

**Horizontal overflow on the page.**

```js
() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
});
```

`scrollWidth > clientWidth` means the page scrolls sideways, which at 390px is nearly always a fixed
width or an untruncated string. **An inner scroller is not a finding**: the transactions table is
deliberately `overflow-x-auto` inside its container (`transaction-list.tsx:119`), and the check above
is on `documentElement` precisely so that stays out of the report.

**Console errors.** `browser_console_messages` at `level: "error"`, after the page has settled. Next.js
surfaces hydration mismatches here, and a hydration mismatch caused by a layout change reads as a
visual glitch that only appears on first paint. **A clean route logs zero errors**, so treat any
error as a finding rather than looking for a known-good list to excuse it. If `/favicon.ico` 404s,
that is a regression: `src/app/icon.svg` is the Next.js file-convention icon, and the `<link
rel="icon">` it generates is the only reason the browser stops falling back to `/favicon.ico`. The
route itself still 404s when requested directly, which is expected and not worth reporting — the
question is whether anything requests it.

**The screenshots themselves.** Take `fullPage: true` for the layout read — the fold cuts off exactly
the part of a long page nobody checked.

**But drop `fullPage` for anything positioned `sticky` or `fixed`**, which a full-page capture
renders at its scroll-top position and stretches to the full document height. That covers the
sidebar (`sticky`, `100vh`-derived), and every dialog in the app: the mobile drawer is
`fixed inset-y-3` behind a `fixed inset-0` overlay, and the add-transaction and category dialogs are
the same. A `fullPage` shot of an open drawer shows an overlay running the length of the document
and tells you nothing about what a user sees. Screenshot the viewport for those. `Read` each file the
tool reports back — the path in the response is not the picture, and a run that never opened one has
checked nothing. The dark circular **N** badge in the bottom-left corner is the Next.js Dev Tools
button, present in every development screenshot; it is not part of the design.

**The design system.** `apps/frontend/CLAUDE.md` holds the rules the screenshot is judged against —
`.panel` surfaces on the warm canvas, pill-shaped (`rounded-full`) controls, filled rather than
outlined inputs, the `income`/`balance`/`expense` tints used semantically, and the sidebar's sticky
offset matching the canvas padding on the wrapper. A `rounded-md` control or a hard-coded colour is
off-system and worth reporting even when nothing is misaligned.

## 7. Close the browser

Call `browser_close` when the run ends, including when it ends early on a failure. A browser left
open and logged in makes the _next_ run's step 4 pass without proving anything, which is the failure
mode where the check silently stops checking.

## 8. Report, and do not fix

Say which routes you opened, at which viewports, and what each screenshot showed. Then:

- **Lead with what is broken**, each item naming the route, the viewport width, and the screenshot
  path. "The category filter overflows at 390px on `/transactions`" is a finding; "mobile looks a bit
  tight" is not.
- **Say what you did not open.** Step 3 deliberately narrows the sweep, and the routes you skipped
  are one sentence.
- **Report console errors separately from visual ones.** They have different causes and different
  fixes.

**Do not edit the frontend to fix what you found.** The task is a check; the finding is the
deliverable. Repairing a layout mid-run means the screenshots in the report no longer describe the
code in the working tree, and the user loses the chance to decide whether the fix belongs in this
change. The same rule the `add-test` skill applies to the code under test applies here.

No documentation update is needed — `.claude/.docs/` describes behavior, and looking at a page does
not change any. Committing is the `commit` skill; opening a PR is the `pr` skill.
