import {
  API_ROUTES,
  type CreateTransactionInput,
  type PaginatedResponse,
  type TransactionDto,
  type TransactionQuery,
  type TransactionSummaryDto,
} from "@expense-tracker/shared";
import { queryOptions } from "@tanstack/react-query";

import { apiClient, retryApiQuery } from "../api-client";

function compactQuery(query: TransactionQuery): TransactionQuery {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ""),
  ) as TransactionQuery;
}

function serializeQuery(query: TransactionQuery): string {
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

export function createTransaction(input: CreateTransactionInput): Promise<TransactionDto> {
  return apiClient.post<TransactionDto>(API_ROUTES.transactions.root, input);
}
