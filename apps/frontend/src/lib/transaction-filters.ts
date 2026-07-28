import type { TransactionQuery, TransactionType } from "@expense-tracker/shared";

/**
 * Reads the transaction list's filter state out of the URL.
 *
 * `/transactions` keeps its filters in query parameters rather than component
 * state so a filtered view can be linked, bookmarked and reloaded. That makes
 * the URL untrusted input: every value here is whatever the address bar
 * contained, so each one is validated down to something the API will accept and
 * anything else falls back to the unfiltered default rather than being
 * forwarded.
 */
export function readPage(value: string | null): number {
  const page = Number(value);
  // Number("") is 0 and Number("x") is NaN; Number.isInteger rejects both, plus
  // Infinity and every fractional page.
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function readType(value: string | null): TransactionType | undefined {
  return value === "INCOME" || value === "EXPENSE" ? value : undefined;
}

export function readTransactionQuery(params: URLSearchParams): TransactionQuery {
  const search = params.get("search")?.trim() ?? "";
  const type = readType(params.get("type"));
  const categoryId = params.get("categoryId") || undefined;

  return {
    page: readPage(params.get("page")),
    ...(search && { search }),
    ...(type && { type }),
    ...(categoryId && { categoryId }),
  };
}

/** Whether the query narrows the list at all — paging alone does not count. */
export function hasActiveFilters(query: TransactionQuery): boolean {
  return Boolean(query.search || query.type || query.categoryId);
}
