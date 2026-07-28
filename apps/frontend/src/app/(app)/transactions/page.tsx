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

  const query = readTransactionQuery(searchParams);
  const { page = 1, search = "", type, categoryId } = query;

  const transactionsQuery = useQuery(transactionsQueryOptions(query));
  const categoriesQuery = useQuery(categoriesQueryOptions);

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
  const selectedCategoryExists =
    !categoryId || categoriesQuery.data?.some((category) => category.id === categoryId);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Search and filter your complete transaction history.
          </p>
        </div>
        <AddTransactionAction />
      </header>

      <section
        className="bg-card border-border rounded-xl border p-4 sm:p-6"
        aria-labelledby="transaction-filters-heading"
      >
        <h2 id="transaction-filters-heading" className="sr-only">
          Transaction filters
        </h2>
        <form
          className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_12rem_14rem_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            updateFilters({ search: String(formData.get("search") ?? "").trim(), page: 1 });
          }}
        >
          <label className="space-y-1.5 text-sm font-medium">
            <span>Search descriptions</span>
            <span className="relative block">
              <Search
                aria-hidden
                className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                key={search}
                name="search"
                type="search"
                defaultValue={search}
                placeholder="e.g. groceries"
                className="border-input bg-background h-9 w-full rounded-md border pr-3 pl-9 text-sm"
              />
            </span>
          </label>

          <label className="space-y-1.5 text-sm font-medium">
            <span>Type</span>
            <select
              value={type ?? ""}
              onChange={(event) =>
                updateFilters({ type: event.target.value || undefined, page: 1 })
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm font-medium">
            <span>Category</span>
            <select
              value={selectedCategoryExists ? (categoryId ?? "") : ""}
              onChange={(event) =>
                updateFilters({ categoryId: event.target.value || undefined, page: 1 })
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
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
            <Button type="submit" variant="outline">
              Search
            </Button>
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

      <section
        className="bg-card border-border rounded-xl border p-4 sm:p-6"
        aria-labelledby="transaction-list-heading"
      >
        <div className="mb-5">
          <h2 id="transaction-list-heading" className="text-lg font-semibold">
            Transaction history
          </h2>
          {transactionsQuery.data && (
            <p className="text-muted-foreground mt-1 text-sm">
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
          <div className="border-border mt-5 border-t pt-5">
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
