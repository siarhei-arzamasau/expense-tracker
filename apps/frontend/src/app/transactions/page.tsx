"use client";

import { API_ROUTES, type TransactionDto, type TransactionType } from "@expense-tracker/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import { formatAmount, formatDate, sumAmounts } from "@/lib/format";
import { categoriesQueryOptions } from "@/lib/queries/categories";

type CategoryFilter = "all" | string;
type TypeFilter = "all" | TransactionType;

export default function TransactionsPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");

  const {
    data: transactions,
    isPending,
    error,
  } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiClient.get<TransactionDto[]>(API_ROUTES.transactions.root),
    retry: (failureCount, err) => !(err instanceof ApiError && err.isUnauthorized),
  });

  const { data: categories, error: categoriesError } = useQuery(categoriesQueryOptions);

  // The token is only readable on the client, so the redirect happens after
  // the first failed request rather than before render.
  useEffect(() => {
    if (
      (error instanceof ApiError && error.isUnauthorized) ||
      (categoriesError instanceof ApiError && categoriesError.isUnauthorized)
    ) {
      authStorage.clear();
      router.push("/login");
    }
  }, [categoriesError, error, router]);

  const filteredTransactions =
    transactions?.filter((transaction) => {
      if (selectedCategory !== "all" && transaction.categoryId !== selectedCategory) return false;
      if (selectedType !== "all" && transaction.type !== selectedType) return false;
      return true;
    }) ?? [];

  // Mixing income and expense into one sum would be meaningless, so each side
  // gets its own total (in cents, same technique as sumAmounts) and balance is
  // their difference.
  const incomeTotal = sumAmounts(
    filteredTransactions.filter((t) => t.type === "INCOME").map((t) => t.amount),
  );
  const expenseTotal = sumAmounts(
    filteredTransactions.filter((t) => t.type === "EXPENSE").map((t) => t.amount),
  );
  const balanceTotal = (
    (Math.round(Number(incomeTotal) * 100) - Math.round(Number(expenseTotal) * 100)) /
    100
  ).toFixed(2);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <Link href="/categories" className="text-sm font-medium underline underline-offset-4">
            Manage categories
          </Link>
        </div>
        {transactions && transactions.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {filteredTransactions.length} entries · income{" "}
            <span className="text-foreground font-medium">{formatAmount(incomeTotal)}</span> ·
            expense{" "}
            <span className="text-foreground font-medium">{formatAmount(expenseTotal)}</span> ·
            balance{" "}
            <span className="text-foreground font-medium">{formatAmount(balanceTotal)}</span>
          </p>
        )}
      </header>

      {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}

      {error && !(error instanceof ApiError && error.isUnauthorized) && (
        <p className="text-destructive text-sm" role="alert">
          {error instanceof ApiError ? error.message : "Could not load transactions"}
        </p>
      )}

      {transactions && transactions.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No transactions yet. Run <code className="font-mono">pnpm db:seed</code> for sample data.
        </p>
      )}

      {transactions && transactions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter transactions by type">
          {(["all", "INCOME", "EXPENSE"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={selectedType === type}
              onClick={() => setSelectedType(type)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedType === type
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {type === "all" ? "All types" : type === "INCOME" ? "Income" : "Expense"}
            </button>
          ))}
        </div>
      )}

      {transactions && transactions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter transactions by category">
          <button
            type="button"
            aria-pressed={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              selectedCategory === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent"
            }`}
          >
            All categories ({transactions.length})
          </button>
          {categories?.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={selectedCategory === category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedCategory === category.id ? "bg-accent font-medium" : "hover:bg-accent"
              }`}
              style={{ borderColor: category.color ?? undefined }}
            >
              {category.icon ? `${category.icon} ` : ""}
              {category.name} ({category.transactionCount})
            </button>
          ))}
        </div>
      )}

      {transactions && transactions.length > 0 && filteredTransactions.length === 0 && (
        <p className="text-muted-foreground text-sm">No transactions match these filters.</p>
      )}

      {filteredTransactions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-border/50 border-b">
                  <td className="text-muted-foreground py-3 whitespace-nowrap">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="py-3">{transaction.description ?? "—"}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {transaction.category.icon ? (
                        <span aria-hidden>{transaction.category.icon}</span>
                      ) : (
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: transaction.category.color ?? "currentColor" }}
                        />
                      )}
                      {transaction.category.name}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={
                        transaction.type === "INCOME" ? "text-green-600" : "text-muted-foreground"
                      }
                    >
                      {transaction.type === "INCOME" ? "Income" : "Expense"}
                    </span>
                  </td>
                  {/* amount is a string from the API — formatAmount parses it */}
                  <td className="py-3 text-right font-medium tabular-nums">
                    {transaction.type === "EXPENSE" ? "−" : "+"}
                    {formatAmount(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
