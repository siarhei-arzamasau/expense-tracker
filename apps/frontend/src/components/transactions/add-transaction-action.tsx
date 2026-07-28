"use client";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { categoriesQueryOptions } from "@/lib/queries/categories";

import { AddTransactionDialog } from "./add-transaction-dialog";

/**
 * The "Add transaction" button together with the states its categories can be
 * in — loading, unreachable, ready.
 *
 * The dialog cannot open without the full category list to populate its select,
 * so owning that fetch belongs here rather than in every page header that
 * places the button. Pages that need the categories for their own filters can
 * still call `useQuery(categoriesQueryOptions)`: it is the same query key, so
 * TanStack serves both from one cache entry and one request.
 */
export function AddTransactionAction() {
  const categoriesQuery = useQuery(categoriesQueryOptions);

  if (categoriesQuery.isPending) {
    return (
      <div
        className="bg-muted h-9 w-36 animate-pulse rounded-md"
        aria-label="Loading transaction categories"
      />
    );
  }

  // A 401 already has the user on their way to /login — offering a retry would
  // only flash an error at them mid-redirect.
  const isExpectedAuthFailure =
    categoriesQuery.error instanceof ApiError && categoriesQuery.error.isUnauthorized;

  if (categoriesQuery.error && !isExpectedAuthFailure) {
    return (
      <div className="text-right">
        <Button type="button" variant="outline" onClick={() => void categoriesQuery.refetch()}>
          Retry categories
        </Button>
        <p className="text-destructive mt-1 text-xs" role="alert">
          Add transaction is unavailable.
        </p>
      </div>
    );
  }

  if (!categoriesQuery.data) {
    return null;
  }

  return <AddTransactionDialog categories={categoriesQuery.data} />;
}
