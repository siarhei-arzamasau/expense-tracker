/**
 * The envelope every paginated list endpoint returns.
 *
 * Deliberately domain-agnostic: it lives here rather than next to
 * `TransactionDto` so the second paginated endpoint does not have to import a
 * transaction module to describe its own response.
 *
 * `totalPages` is `Math.ceil(totalItems / pageSize)`, so an empty result set
 * reports `0` — a caller rendering "page X of Y" should treat `totalPages < 1`
 * as "no pager", not as "one page".
 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
