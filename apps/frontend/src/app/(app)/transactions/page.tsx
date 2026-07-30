"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import {
  AddTransactionAction,
  TransactionList,
  TransactionPagination,
} from "@/components/transactions";
import { Button } from "@/components/ui/button";
import { categoriesQueryOptions } from "@/lib/queries/categories";
import { transactionsQueryOptions } from "@/lib/queries/transactions";
import { hasActiveFilters, readTransactionQuery } from "@/lib/transaction-filters";

function TransactionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedQuery = readTransactionQuery(searchParams);
  const categoriesQuery = useQuery(categoriesQueryOptions);
  const query =
    requestedQuery.categoryId &&
    categoriesQuery.data &&
    !categoriesQuery.data.some((category) => category.id === requestedQuery.categoryId)
      ? { ...requestedQuery, categoryId: undefined }
      : requestedQuery;
  const { page = 1, search = "", type, categoryId } = query;

  const transactionsQuery = useQuery(transactionsQueryOptions(query));

  const updateFilters = (updates: Record<string, string | number | undefined>): void => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || (key === "page" && value === 1)) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }
    const href = next.size > 0 ? `/transactions?${next}` : "/transactions";
    router.push(href);
  };

  useEffect(() => {
    const totalPages = transactionsQuery.data?.totalPages ?? 0;
    if (totalPages > 0 && page > totalPages) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("page", String(totalPages));
      router.replace(`/transactions?${next}`);
    }
  }, [page, router, searchParams, transactionsQuery.data?.totalPages]);

  const hasFilters = hasActiveFilters(query);

  return (
    <main className="space-y-7 px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="mt-2 text-[1.75rem] leading-none font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-2.5 text-sm">
            Search and filter your complete transaction history.
          </p>
        </div>
        <AddTransactionAction />
      </header>

      <section
        className="bg-secondary/60 rounded-2xl p-4 sm:p-5"
        aria-labelledby="transaction-filters-heading"
      >
        <h2 id="transaction-filters-heading" className="sr-only">
          Transaction filters
        </h2>
        <form
          className="grid gap-4 lg:grid-cols-[minmax(15rem,1fr)_11rem_13rem_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            updateFilters({ search: String(formData.get("search") ?? "").trim(), page: 1 });
          }}
        >
          <label className="space-y-2 text-[0.8125rem] font-semibold">
            <span>Search descriptions</span>
            <span className="relative block">
              <Search
                aria-hidden
                className="text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2"
                strokeWidth={1.75}
              />
              <input
                key={search}
                name="search"
                type="search"
                defaultValue={search}
                placeholder="e.g. groceries"
                className="bg-background border-input placeholder:text-muted-foreground focus-visible:ring-ring/70 h-10 w-full rounded-full border pr-4 pl-10 text-sm font-normal transition-[border-color,box-shadow] outline-none focus-visible:ring-[3px]"
              />
            </span>
          </label>

          <label className="space-y-2 text-[0.8125rem] font-semibold">
            <span>Type</span>
            <select
              value={type ?? ""}
              onChange={(event) =>
                updateFilters({ type: event.target.value || undefined, page: 1 })
              }
              className="bg-background border-input focus-visible:ring-ring/70 h-10 w-full rounded-full border px-4 text-sm font-normal transition-[border-color,box-shadow] outline-none focus-visible:ring-[3px]"
            >
              <option value="">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>

          <label className="space-y-2 text-[0.8125rem] font-semibold">
            <span>Category</span>
            <select
              value={categoryId ?? ""}
              onChange={(event) =>
                updateFilters({ categoryId: event.target.value || undefined, page: 1 })
              }
              className="bg-background border-input focus-visible:ring-ring/70 h-10 w-full rounded-full border px-4 text-sm font-normal transition-[border-color,box-shadow] outline-none focus-visible:ring-[3px]"
            >
              <option value="">All categories</option>
              {categoriesQuery.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  router.push("/transactions");
                }}
              >
                <X aria-hidden />
                Clear
              </Button>
            )}
          </div>
        </form>
      </section>

      <section aria-labelledby="transaction-list-heading">
        <div className="mb-5">
          <h2 id="transaction-list-heading" className="text-xl font-semibold">
            Transaction history
          </h2>
          {/* The filters replace the list without a navigation a screen reader
              would announce — the selects submit on change and the search form
              re-renders in place. This count is the only thing that states the
              outcome, so it has to be the live region that reports it. */}
          {transactionsQuery.data && (
            <p className="text-muted-foreground mt-1 text-sm" aria-live="polite">
              {transactionsQuery.data.totalItems}{" "}
              {transactionsQuery.data.totalItems === 1 ? "result" : "results"}
            </p>
          )}
        </div>

        <TransactionList
          data={transactionsQuery.data}
          isPending={transactionsQuery.isPending}
          error={transactionsQuery.error}
          onRetry={() => void transactionsQuery.refetch()}
          emptyMessage={
            hasFilters
              ? "No transactions match these filters."
              : "No transactions yet. Add one to start tracking your money."
          }
        />

        {transactionsQuery.data && transactionsQuery.data.totalPages > 1 && (
          <div className="mt-6">
            <TransactionPagination
              page={transactionsQuery.data.page}
              totalPages={transactionsQuery.data.totalPages}
              onPageChange={(nextPage) => updateFilters({ page: nextPage })}
            />
          </div>
        )}
      </section>
    </main>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<main className="min-h-[50vh]" aria-busy="true" />}>
      <TransactionsPageContent />
    </Suspense>
  );
}
