# Transaction description search

## Summary

Add an immediate, case-insensitive free-text search to the transactions page. Search remains
client-side and composes with the existing category and type filters.

## Implementation changes

- Add `search` state and a labeled `type="search"` input to the existing filter area in
  `apps/frontend/src/app/transactions/page.tsx`.
- Normalize the query with `trim().toLowerCase()` and match it against `transaction.description`;
  transactions without descriptions do not match a non-empty query.
- Apply search, category, and type conditions with AND semantics in the existing
  `filteredTransactions` calculation.
- Keep the displayed entry count, income, expense, balance, and table rows derived from the combined
  filtered result.
- Show a search-specific empty message when text search has no results; preserve the existing initial
  empty-state message when the account has no transactions.
- Make no backend, database, shared-type, route, pagination, or dependency changes.

## Acceptance criteria and verification

- Search matches descriptions regardless of letter case.
- Leading or trailing query whitespace is ignored; an empty or whitespace-only query shows all
  transactions permitted by the other filters.
- Search results update as the user types.
- Search composes correctly with both type and category filters.
- Clearing the query restores the corresponding filtered transaction set and totals.
- Null descriptions do not cause errors or match a non-empty query.
- The result count and all three totals reflect only visible transactions.
- Verify with `pnpm --filter @expense-tracker/frontend typecheck`, frontend lint,
  `pnpm format:check`, and a browser smoke test covering matching, no-match, clearing, and
  combined-filter scenarios.

## Assumptions

- Free-text search targets descriptions only; category selection remains handled by the existing
  category chips.
- Search state is page-local and is not persisted in the URL or across navigation.
- Client-side filtering is appropriate because the page already loads the complete unpaginated
  transaction collection.
