import type { PaginatedResponse, TransactionDto } from "@expense-tracker/shared";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { formatAmount, formatDate } from "@/lib/format";

interface TransactionListProps {
  data: PaginatedResponse<TransactionDto> | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  emptyMessage?: string;
}

function CategoryMarker({ transaction }: { transaction: TransactionDto }) {
  return (
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
  );
}

function SignedAmount({ transaction }: { transaction: TransactionDto }) {
  return (
    <span
      className={`font-medium tabular-nums ${
        transaction.type === "INCOME" ? "text-green-600" : "text-foreground"
      }`}
    >
      {transaction.type === "EXPENSE" ? "−" : "+"}
      {formatAmount(transaction.amount)}
    </span>
  );
}

function TransactionListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading transactions" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="border-border flex animate-pulse items-center gap-4 border-b py-4"
        >
          <div className="bg-muted h-4 w-20 rounded" />
          <div className="bg-muted h-4 flex-1 rounded" />
          <div className="bg-muted h-4 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TransactionList({
  data,
  isPending,
  error,
  onRetry,
  emptyMessage = "No transactions found.",
}: TransactionListProps) {
  if (isPending) return <TransactionListSkeleton />;

  if (error) {
    if (error instanceof ApiError && error.isUnauthorized) return null;

    return (
      <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-4" role="alert">
        <p className="text-destructive text-sm">
          {error instanceof ApiError ? error.message : "Could not load transactions."}
        </p>
        <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left">
              <th scope="col" className="py-2 font-medium">
                Date
              </th>
              <th scope="col" className="py-2 font-medium">
                Description
              </th>
              <th scope="col" className="py-2 font-medium">
                Category
              </th>
              <th scope="col" className="py-2 font-medium">
                Type
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((transaction) => (
              <tr key={transaction.id} className="border-border/50 border-b">
                <td className="text-muted-foreground py-3 whitespace-nowrap">
                  {formatDate(transaction.date)}
                </td>
                <td className="max-w-64 truncate py-3">{transaction.description ?? "—"}</td>
                <td className="py-3">
                  <CategoryMarker transaction={transaction} />
                </td>
                <td className="py-3">{transaction.type === "INCOME" ? "Income" : "Expense"}</td>
                <td className="py-3 text-right">
                  <SignedAmount transaction={transaction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border divide-y md:hidden">
        {data.items.map((transaction) => (
          <li key={transaction.id} className="space-y-2 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {transaction.description ?? "Transaction"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">{formatDate(transaction.date)}</p>
              </div>
              <SignedAmount transaction={transaction} />
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <CategoryMarker transaction={transaction} />
              <span>{transaction.type === "INCOME" ? "Income" : "Expense"}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export type { TransactionListProps };
