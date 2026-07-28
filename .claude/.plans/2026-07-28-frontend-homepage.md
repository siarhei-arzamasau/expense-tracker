# Authenticated Expense Dashboard

## Summary

- Replace `/` with a protected dashboard; signed-out visitors redirect to `/login`.
- Introduce a responsive shared app shell for `/`, `/transactions`, `/categories`, and `/profile`.
- Show current-month totals, a server-paginated transaction list with 10 items per page, user identity, and a working “Add transaction” flow.
- Preserve the existing neutral Tailwind visual language, use Lucide icons, add no dependencies, and document decisions in a new root `DESIGN.md`.

## Implementation Changes

- Build a desktop sidebar and mobile header/menu with Dashboard, Transactions, Categories, Profile, and Logout actions. Load identity from `GET /auth/me`, show initials when no avatar exists, and clear both token and query cache on logout or any authenticated 401.
- Redirect successful login and registration to `/`. Keep authentication, password-reset, legal, and privacy pages outside the protected shell.
- Dashboard:
  - Display balance, income, and expenses for the current month using `GET /transactions/summary`.
  - Render transactions as a table on desktop and compact cards on mobile.
  - Show 10 records per page with previous/next controls, current page, total pages, loading skeletons, empty states, and retryable errors.
  - Provide an accessible add-transaction dialog containing type, amount, category, date, and optional description. If no categories exist, disable submission and link to category creation.
- `/transactions`:
  - Reuse the dashboard transaction table and pagination primitives.
  - Keep description search, type filtering, and category filtering, but execute them server-side across the entire dataset.
  - Store page and filter state in URL query parameters; changing a filter returns to page 1.
- `/profile`:
  - Add forms for name/email updates and password changes.
  - Add logout and password-confirmed account deletion.
  - Refresh cached user data after profile edits; clear sensitive fields after password operations; clear authentication and redirect after deletion.
- After transaction creation, invalidate transaction pages, monthly summary, and categories because category transaction counts change.

## API and Type Changes

- Change `GET /transactions` from `TransactionDto[]` to:
  - `items: TransactionDto[]`
  - `page: number`
  - `pageSize: 10`
  - `totalItems: number`
  - `totalPages: number`
- Extend the query DTO with validated `page` and optional description `search`; retain existing type, category, and date filters.
- Apply identical user-scoped filters to Prisma `count` and `findMany`, using `skip`, `take: 10`, and deterministic newest-first ordering by date and a stable secondary key.
- Perform case-insensitive description search. An out-of-range page returns an empty `items` array with valid metadata, allowing the frontend to navigate to the last available page.
- Add shared paginated-response and transaction-query types, reusable TanStack Query options, profile mutations, and an API-client delete method that supports the account-deletion request body.
- Update Swagger metadata and backend unit tests for the new contract.
- Synchronize `AGENTS.md` and `CLAUDE.md` to replace the now-obsolete “transactions are unpaginated/client-filtered” guidance, and update the README route description.

## Test Plan

- Backend tests: default page behavior, ten-item limit, offset calculation, total-page calculation, combined search/filter conditions, user isolation, deterministic ordering, empty results, and out-of-range pages.
- Profile and creation checks: validation failures, missing/foreign category rejection, query invalidation after creation, profile-cache refresh, password errors, logout, and deletion cleanup.
- Frontend verification: protected-route redirects, no authenticated-content flash, desktop/mobile navigation, keyboard-accessible menu/dialog/pagination, responsive transaction presentation, loading/error/empty states, and preserved filter state across navigation.
- Run targeted backend tests followed by workspace `typecheck`, `lint`, `test`, `format:check`, frontend build, and a seeded browser smoke test.

## Assumptions

- Page size is fixed at 10; users cannot select a different size.
- The dashboard uses the current calendar month and does not add charts or historical comparison in this feature.
- Transaction creation is included; transaction editing and deletion remain outside scope.
- `/transactions` remains the full searchable view, while `/` presents the overview and a compact paginated transaction section.
- User-facing copy remains English, consistent with the existing application.
