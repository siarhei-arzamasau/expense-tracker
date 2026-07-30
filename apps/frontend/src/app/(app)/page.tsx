"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import {
  AddTransactionAction,
  TransactionList,
  TransactionPagination,
} from "@/components/transactions";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { flowShares, formatAmount, formatShare } from "@/lib/format";
import {
  currentMonthSummaryQueryOptions,
  transactionsQueryOptions,
} from "@/lib/queries/transactions";

type Tone = "balance" | "income" | "expense";

/** Held rather than rebuilt each render — see the note in `lib/format.ts`. */
const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const TONE_CLASSES: Record<Tone, { surface: string; ink: string; track: string; fill: string }> = {
  balance: {
    surface: "bg-balance",
    ink: "text-balance-ink",
    track: "bg-balance-ink/12",
    fill: "bg-balance-ink",
  },
  income: {
    surface: "bg-income",
    ink: "text-income-ink",
    track: "bg-income-ink/12",
    fill: "bg-income-ink",
  },
  expense: {
    surface: "bg-expense",
    ink: "text-expense-ink",
    track: "bg-expense-ink/12",
    fill: "bg-expense-ink",
  },
};

interface SummaryCardProps {
  label: string;
  amount?: string;
  isPending: boolean;
  icon: typeof Wallet;
  tone: Tone;
  children?: ReactNode;
}

/**
 * A pastel tile with an ink-filled marker, a display-face figure, and a bar
 * underneath. The bar is drawn from the month's own totals — it is the figure's
 * share of everything that moved — so it carries information rather than
 * decorating the card with a shape.
 */
function SummaryCard({ label, amount, isPending, icon: Icon, tone, children }: SummaryCardProps) {
  const classes = TONE_CLASSES[tone];

  return (
    <div className={`${classes.surface} rounded-2xl p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <p className={`eyebrow ${classes.ink} pt-1.5`}>{label}</p>
      </div>

      {isPending ? (
        <div className="bg-primary/8 mt-6 h-9 w-36 animate-pulse rounded-lg" />
      ) : amount === undefined ? (
        // No `opacity-70`: the tint inks are picked to clear 4.5:1 on their own
        // pastel at full strength and nowhere above it, so dimming them dropped
        // this to 2.85:1 on expense and 3.35/3.42 on income and balance.
        <p className={`${classes.ink} mt-6 text-sm font-medium`}>Unavailable</p>
      ) : (
        <p className="font-display mt-6 text-[1.75rem] leading-none font-bold tracking-tight tabular-nums sm:text-[2rem]">
          {formatAmount(amount)}
        </p>
      )}

      <div className="mt-5">{children}</div>
    </div>
  );
}

/** A single filled segment of the month's flow. */
function ShareBar({ tone, share, caption }: { tone: Tone; share: number; caption: string }) {
  const classes = TONE_CLASSES[tone];

  return (
    <>
      <div className={`${classes.track} h-1.5 overflow-hidden rounded-full`} aria-hidden>
        <div
          className={`${classes.fill} h-full rounded-full transition-[width] duration-700 ease-out`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className={`${classes.ink} mt-2.5 text-xs font-medium`}>{caption}</p>
    </>
  );
}

/** Both halves of the month on one track, which is what a balance is made of. */
function SplitBar({ income, expense }: { income: number; expense: number }) {
  const empty = income === 0 && expense === 0;

  return (
    <>
      <div
        className="bg-balance-ink/12 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          className="bg-income-ink h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${income * 100}%` }}
        />
        <div
          className="bg-expense-ink h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${expense * 100}%` }}
        />
      </div>
      <p className="text-balance-ink mt-2.5 flex items-center gap-3 text-xs font-medium">
        {empty ? (
          "Nothing recorded yet"
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="bg-income-ink size-1.5 rounded-full" />
              {formatShare(income)} in
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="bg-expense-ink size-1.5 rounded-full" />
              {formatShare(expense)} out
            </span>
          </>
        )}
      </p>
    </>
  );
}

export default function DashboardPage() {
  const [page, setPage] = useState(1);
  const monthLabel = monthLabelFormatter.format(new Date());

  const transactionsQuery = useQuery(transactionsQueryOptions({ page }));
  const summaryQuery = useQuery(currentMonthSummaryQueryOptions());

  // Pages can vanish underneath the reader, leaving an empty table and a pager
  // pointing past the end. Corrected during render, not in an effect: React
  // discards this pass and re-runs with the clamped page before committing, so
  // the out-of-range page is never painted. An effect would paint the empty
  // state first and then flip. https://react.dev/learn/you-might-not-need-an-effect
  const totalPages = transactionsQuery.data?.totalPages ?? 0;
  if (totalPages > 0 && page > totalPages) {
    setPage(totalPages);
  }

  const summary = summaryQuery.data;
  const shares = summary ? flowShares(summary.income, summary.expense) : { income: 0, expense: 0 };
  const hasFlow = shares.income > 0 || shares.expense > 0;

  return (
    <main className="space-y-8 px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{monthLabel}</p>
          <h1 className="mt-2 text-[1.75rem] leading-none font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2.5 text-sm">
            Where your money went this month, and what landed most recently.
          </p>
        </div>
        <AddTransactionAction />
      </header>

      <section aria-label={`Financial summary for ${monthLabel}`}>
        {summaryQuery.error &&
          !(summaryQuery.error instanceof ApiError && summaryQuery.error.isUnauthorized) && (
            <div
              role="alert"
              className="bg-destructive/8 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
            >
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
        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryCard
            label="Balance"
            amount={summary?.balance}
            isPending={summaryQuery.isPending}
            icon={Wallet}
            tone="balance"
          >
            <SplitBar income={shares.income} expense={shares.expense} />
          </SummaryCard>
          <SummaryCard
            label="Income"
            amount={summary?.income}
            isPending={summaryQuery.isPending}
            icon={ArrowUpRight}
            tone="income"
          >
            <ShareBar
              tone="income"
              share={shares.income}
              caption={
                hasFlow ? `${formatShare(shares.income)} of the month's flow` : "Nothing in yet"
              }
            />
          </SummaryCard>
          <SummaryCard
            label="Expenses"
            amount={summary?.expense}
            isPending={summaryQuery.isPending}
            icon={ArrowDownRight}
            tone="expense"
          >
            <ShareBar
              tone="expense"
              share={shares.expense}
              caption={
                hasFlow ? `${formatShare(shares.expense)} of the month's flow` : "Nothing out yet"
              }
            />
          </SummaryCard>
        </div>
      </section>

      <section aria-labelledby="recent-transactions-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-transactions-heading" className="text-xl font-semibold">
              Recent transactions
            </h2>
            {transactionsQuery.data && (
              <p className="text-muted-foreground mt-1 text-sm">
                {transactionsQuery.data.totalItems} total
              </p>
            )}
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/transactions">View and filter all</Link>
          </Button>
        </div>

        <TransactionList
          data={transactionsQuery.data}
          isPending={transactionsQuery.isPending}
          error={transactionsQuery.error}
          onRetry={() => void transactionsQuery.refetch()}
          emptyMessage="No transactions yet. Add one to start tracking your money."
        />

        {transactionsQuery.data && transactionsQuery.data.totalPages > 1 && (
          <div className="mt-6">
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
