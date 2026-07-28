"use client";

import { API_ROUTES, type ExpenseDto } from "@expense-tracker/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth-storage";
import { formatAmount, formatDate, sumAmounts } from "@/lib/format";
import { categoriesQueryOptions } from "@/lib/queries/categories";

type CategoryFilter = "all" | "uncategorized" | string;

export default function ExpensesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");

  const {
    data: expenses,
    isPending,
    error,
  } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiClient.get<ExpenseDto[]>(API_ROUTES.expenses.root),
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

  const filteredExpenses =
    expenses?.filter((expense) => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "uncategorized") return expense.categoryId === null;
      return expense.categoryId === selectedCategory;
    }) ?? [];

  const uncategorizedCount = expenses?.filter((expense) => expense.categoryId === null).length ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <Link href="/categories" className="text-sm font-medium underline underline-offset-4">
            Manage categories
          </Link>
        </div>
        {expenses && expenses.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {filteredExpenses.length} entries ·{" "}
            <span className="text-foreground font-medium">
              {formatAmount(sumAmounts(filteredExpenses.map((expense) => expense.amount)))}
            </span>
          </p>
        )}
      </header>

      {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}

      {error && !(error instanceof ApiError && error.isUnauthorized) && (
        <p className="text-destructive text-sm" role="alert">
          {error instanceof ApiError ? error.message : "Could not load expenses"}
        </p>
      )}

      {expenses && expenses.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No expenses yet. Run <code className="font-mono">pnpm db:seed</code> for sample data.
        </p>
      )}

      {expenses && expenses.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter expenses by category">
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
            All ({expenses.length})
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
              {category.name} ({category.expenseCount})
            </button>
          ))}
          <button
            type="button"
            aria-pressed={selectedCategory === "uncategorized"}
            onClick={() => setSelectedCategory("uncategorized")}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              selectedCategory === "uncategorized"
                ? "bg-accent font-medium"
                : "border-border hover:bg-accent"
            }`}
          >
            Uncategorized ({uncategorizedCount})
          </button>
        </div>
      )}

      {expenses && expenses.length > 0 && filteredExpenses.length === 0 && (
        <p className="text-muted-foreground text-sm">No expenses match this category.</p>
      )}

      {filteredExpenses.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="border-border/50 border-b">
                  <td className="text-muted-foreground py-3 whitespace-nowrap">
                    {formatDate(expense.spentAt)}
                  </td>
                  <td className="py-3">{expense.description ?? "—"}</td>
                  <td className="py-3">
                    {expense.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        {expense.category.icon ? (
                          <span aria-hidden>{expense.category.icon}</span>
                        ) : (
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: expense.category.color ?? "currentColor" }}
                          />
                        )}
                        {expense.category.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Uncategorized</span>
                    )}
                  </td>
                  {/* amount is a string from the API — formatAmount parses it */}
                  <td className="py-3 text-right font-medium tabular-nums">
                    {formatAmount(expense.amount)}
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
