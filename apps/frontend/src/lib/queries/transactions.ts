import {
  API_ROUTES,
  type CreateTransactionInput,
  type PaginatedResponse,
  type TransactionDto,
  type TransactionQuery,
  type TransactionSummaryDto,
} from "@expense-tracker/shared";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { apiClient, retryApiQuery } from "../api-client";

/**
 * Drops keys the API should not receive at all.
 *
 * Also what makes the query key stable: `{ page: 1 }` and
 * `{ page: 1, search: "" }` describe the same request and must not open two
 * cache entries.
 */
export function compactQuery(query: TransactionQuery): TransactionQuery {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ""),
  ) as TransactionQuery;
}

export function serializeQuery(query: TransactionQuery): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(compactQuery(query))) {
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export const transactionQueryKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionQueryKeys.all, "list"] as const,
  list: (query: TransactionQuery) =>
    [...transactionQueryKeys.lists(), compactQuery(query)] as const,
  summaries: () => [...transactionQueryKeys.all, "summary"] as const,
  summary: (month: number, year: number) =>
    [...transactionQueryKeys.summaries(), { month, year }] as const,
};

export function transactionsQueryOptions(query: TransactionQuery) {
  const normalizedQuery = compactQuery(query);

  return queryOptions({
    queryKey: transactionQueryKeys.list(normalizedQuery),
    queryFn: ({ signal }) =>
      apiClient.get<PaginatedResponse<TransactionDto>>(
        `${API_ROUTES.transactions.root}${serializeQuery(normalizedQuery)}`,
        { signal },
      ),
    retry: retryApiQuery,
    // Paging and filtering change the query key, and an unseen key resolves to
    // `data: undefined` — which would blank the table *and* unmount the pager
    // the user just clicked, taking keyboard focus with it. Holding the last
    // page keeps the controls mounted while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function transactionSummaryQueryOptions(month: number, year: number) {
  const query = new URLSearchParams({ month: String(month), year: String(year) });

  return queryOptions({
    queryKey: transactionQueryKeys.summary(month, year),
    queryFn: ({ signal }) =>
      apiClient.get<TransactionSummaryDto>(`${API_ROUTES.transactions.summary}?${query}`, {
        signal,
      }),
    retry: retryApiQuery,
  });
}

/**
 * The summary the dashboard shows: the month it is being viewed in.
 *
 * The month and year are derived here rather than at each call site because two
 * places have to agree on them — `AppShell` prefetches this while `/auth/me` is
 * in flight and the dashboard reads it a moment later. They must produce the
 * same query key or the prefetch silently becomes a wasted request and the
 * dashboard fetches again, which is exactly the waterfall the prefetch exists to
 * remove and nothing would report it.
 */
export function currentMonthSummaryQueryOptions() {
  const now = new Date();
  return transactionSummaryQueryOptions(now.getMonth() + 1, now.getFullYear());
}

export function createTransaction(input: CreateTransactionInput): Promise<TransactionDto> {
  return apiClient.post<TransactionDto>(API_ROUTES.transactions.root, input);
}
