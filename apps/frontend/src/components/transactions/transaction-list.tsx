import type { PaginatedResponse, TransactionDto } from "@expense-tracker/shared";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

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

/**
 * The direction marker: a tinted disc holding the arrow, which is what makes a
 * long list scannable without reading a single number. It carries the type as
 * its accessible name, so dropping the "Type" column costs a screen reader
 * nothing.
 */
function DirectionMarker({ type }: { type: TransactionDto["type"] }) {
  const income = type === "INCOME";
  const Icon = income ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
        income ? "bg-income text-income-ink" : "bg-expense text-expense-ink"
      }`}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.25} />
      <span className="sr-only">{income ? "Income" : "Expense"}</span>
    </span>
  );
}

function CategoryMarker({ transaction }: { transaction: TransactionDto }) {
  return (
    <span className="bg-secondary inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 text-[0.8125rem] font-medium">
      {transaction.category.icon ? (
        <span aria-hidden className="text-sm leading-none">
          {transaction.category.icon}
        </span>
      ) : (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: transaction.category.color ?? "currentColor" }}
        />
      )}
      <span className="truncate">{transaction.category.name}</span>
    </span>
  );
}

function SignedAmount({ transaction }: { transaction: TransactionDto }) {
  return (
    <span
      className={`font-display font-semibold tabular-nums ${
        transaction.type === "INCOME" ? "text-income-ink" : "text-foreground"
      }`}
    >
      {transaction.type === "EXPENSE" ? "−" : "+"}
      {formatAmount(transaction.amount)}
    </span>
  );
}

function TransactionListSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading transactions" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-4 rounded-2xl px-3 py-3.5">
          <div className="bg-secondary size-9 shrink-0 rounded-xl" />
          <div className="bg-secondary h-4 flex-1 rounded-full" />
          <div className="bg-secondary h-4 w-20 rounded-full" />
          <div className="bg-secondary h-4 w-24 rounded-full" />
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
      <div className="bg-destructive/8 rounded-2xl p-5" role="alert">
        <p className="text-destructive text-sm">
          {error instanceof ApiError ? error.message : "Could not load transactions."}
        </p>
        <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="bg-secondary/60 rounded-2xl px-6 py-14 text-center">
        <p className="text-muted-foreground mx-auto max-w-xs text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="w-12 px-3 pb-2">
                <span className="sr-only">Direction</span>
              </th>
              <th scope="col" className="eyebrow px-3 pb-2 font-semibold">
                Description
              </th>
              <th scope="col" className="eyebrow px-3 pb-2 font-semibold">
                Category
              </th>
              <th scope="col" className="eyebrow px-3 pb-2 font-semibold">
                Date
              </th>
              <th scope="col" className="eyebrow px-3 pb-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((transaction) => (
              <tr
                key={transaction.id}
                className="[&:hover>td]:bg-secondary/60 [&>td]:transition-colors"
              >
                <td className="rounded-l-2xl py-2.5 pr-0 pl-3">
                  <DirectionMarker type={transaction.type} />
                </td>
                <td className="max-w-72 truncate px-3 py-2.5 font-medium">
                  {transaction.description ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <CategoryMarker transaction={transaction} />
                </td>
                <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                  {formatDate(transaction.date)}
                </td>
                <td className="rounded-r-2xl px-3 py-2.5 text-right">
                  <SignedAmount transaction={transaction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-1 md:hidden">
        {data.items.map((transaction) => (
          <li key={transaction.id} className="flex items-center gap-3 rounded-2xl px-1 py-3">
            <DirectionMarker type={transaction.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {transaction.description ?? "Transaction"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{formatDate(transaction.date)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <SignedAmount transaction={transaction} />
              <CategoryMarker transaction={transaction} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export type { TransactionListProps };
