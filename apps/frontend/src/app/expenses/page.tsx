"use client";

import { API_ROUTES, type ExpenseDto } from "@expense-tracker/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { apiClient, ApiError } from "@/lib/api-client";
import { formatAmount, formatDate, sumAmounts } from "@/lib/format";

export default function ExpensesPage() {
  const router = useRouter();

  const {
    data: expenses,
    isPending,
    error,
  } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiClient.get<ExpenseDto[]>(API_ROUTES.expenses.root),
    retry: (failureCount, err) => !(err instanceof ApiError && err.isUnauthorized),
  });

  // The token is only readable on the client, so the redirect happens after
  // the first failed request rather than before render.
  useEffect(() => {
    if (error instanceof ApiError && error.isUnauthorized) {
      router.push("/login");
    }
  }, [error, router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        {expenses && expenses.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {expenses.length} entries ·{" "}
            <span className="text-foreground font-medium">
              {formatAmount(sumAmounts(expenses.map((expense) => expense.amount)))}
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
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-border/50 border-b">
                  <td className="text-muted-foreground py-3 whitespace-nowrap">
                    {formatDate(expense.spentAt)}
                  </td>
                  <td className="py-3">{expense.description ?? "—"}</td>
                  <td className="py-3">
                    {expense.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: expense.category.color ?? "currentColor" }}
                        />
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
