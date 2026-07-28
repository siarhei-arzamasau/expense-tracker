"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AddTransactionDialog,
  TransactionList,
  TransactionPagination,
} from "@/components/transactions";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { formatAmount } from "@/lib/format";
import { categoriesQueryOptions } from "@/lib/queries/categories";
import {
  transactionsQueryOptions,
  transactionSummaryQueryOptions,
} from "@/lib/queries/transactions";

interface SummaryCardProps {
  label: string;
  amount?: string;
  isPending: boolean;
  icon: typeof Wallet;
  tone?: "default" | "income" | "expense";
}

function SummaryCard({ label, amount, isPending, icon: Icon, tone = "default" }: SummaryCardProps) {
  const toneClass =
    tone === "income"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "expense"
        ? "text-rose-700 bg-rose-50"
        : "text-foreground bg-secondary";

  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-full ${toneClass}`}>
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      {isPending ? (
        <div className="bg-muted mt-4 h-8 w-32 animate-pulse rounded" />
      ) : amount === undefined ? (
        <p className="text-muted-foreground mt-3 text-sm">Unavailable</p>
      ) : (
        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
          {formatAmount(amount)}
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    now,
  );

  const transactionsQuery = useQuery(transactionsQueryOptions({ page }));
  const summaryQuery = useQuery(transactionSummaryQueryOptions(month, year));
  const categoriesQuery = useQuery(categoriesQueryOptions);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{monthLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your monthly totals and latest activity at a glance.
          </p>
        </div>
        {categoriesQuery.isPending ? (
          <div
            className="bg-muted h-9 w-36 animate-pulse rounded-md"
            aria-label="Loading transaction categories"
          />
        ) : categoriesQuery.error &&
          !(categoriesQuery.error instanceof ApiError && categoriesQuery.error.isUnauthorized) ? (
          <div className="text-right">
            <Button type="button" variant="outline" onClick={() => void categoriesQuery.refetch()}>
              Retry categories
            </Button>
            <p className="text-destructive mt-1 text-xs" role="alert">
              Add transaction is unavailable.
            </p>
          </div>
        ) : categoriesQuery.data ? (
          <AddTransactionDialog categories={categoriesQuery.data} />
        ) : (
          <span />
        )}
      </header>

      <section aria-label={`Financial summary for ${monthLabel}`}>
        {summaryQuery.error &&
          !(summaryQuery.error instanceof ApiError && summaryQuery.error.isUnauthorized) && (
            <div className="border-destructive/40 bg-destructive/5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <p className="text-destructive text-sm">
                {summaryQuery.error instanceof ApiError
                  ? summaryQuery.error.message
                  : "Could not load this month's summary."}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void summaryQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Balance"
            amount={summaryQuery.data?.balance}
            isPending={summaryQuery.isPending}
            icon={Wallet}
          />
          <SummaryCard
            label="Income"
            amount={summaryQuery.data?.income}
            isPending={summaryQuery.isPending}
            icon={ArrowUpRight}
            tone="income"
          />
          <SummaryCard
            label="Expenses"
            amount={summaryQuery.data?.expense}
            isPending={summaryQuery.isPending}
            icon={ArrowDownRight}
            tone="expense"
          />
        </div>
      </section>

      <section
        className="bg-card border-border rounded-xl border p-4 sm:p-6"
        aria-labelledby="recent-transactions-heading"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="recent-transactions-heading" className="text-lg font-semibold">
              Recent transactions
            </h2>
            {transactionsQuery.data && (
              <p className="text-muted-foreground mt-1 text-sm">
                {transactionsQuery.data.totalItems} total
              </p>
            )}
          </div>
          <Link href="/transactions" className="text-sm font-medium underline underline-offset-4">
            View and filter all
          </Link>
        </div>

        <TransactionList
          data={transactionsQuery.data}
          isPending={transactionsQuery.isPending}
          error={transactionsQuery.error}
          onRetry={() => void transactionsQuery.refetch()}
          emptyMessage="No transactions yet. Add one to start tracking your money."
        />

        {transactionsQuery.data && transactionsQuery.data.totalPages > 1 && (
          <div className="border-border mt-5 border-t pt-5">
            <TransactionPagination
              page={transactionsQuery.data.page}
              totalPages={transactionsQuery.data.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </main>
  );
}
