import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TransactionPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TransactionPagination({
  page,
  totalPages,
  onPageChange,
}: TransactionPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Transaction pages">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Go to previous transaction page"
      >
        <ChevronLeft aria-hidden />
        Previous
      </Button>
      <p
        className="bg-secondary text-muted-foreground rounded-full px-3.5 py-1.5 text-[0.8125rem] tabular-nums"
        aria-live="polite"
      >
        Page <span className="text-foreground font-semibold">{page}</span> of {totalPages}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Go to next transaction page"
      >
        Next
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}

export type { TransactionPaginationProps };
