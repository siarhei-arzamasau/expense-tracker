// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({
  transactionOptions: vi.fn((query: { page: number }) => ({ kind: "transactions", query })),
  summaryOptions: vi.fn(() => ({ kind: "summary" })),
  transactionRefetch: vi.fn(),
  summaryRefetch: vi.fn(),
  transactions: {} as {
    data?: { page: number; totalPages: number; totalItems: number; items: unknown[] };
    error: Error | null;
    isPending: boolean;
    refetch: () => unknown;
  },
  summary: {} as {
    data?: { balance: string; income: string; expense: string };
    error: Error | null;
    isPending: boolean;
    refetch: () => unknown;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { kind: string }) =>
    options.kind === "transactions" ? mocks.transactions : mocks.summary,
}));
vi.mock("@/lib/queries/transactions", () => ({
  transactionsQueryOptions: mocks.transactionOptions,
  currentMonthSummaryQueryOptions: mocks.summaryOptions,
}));
vi.mock("@/components/transactions", () => ({
  AddTransactionAction: () => <button type="button">Add transaction</button>,
  TransactionList: ({ emptyMessage }: { emptyMessage: string }) => <p>{emptyMessage}</p>,
  TransactionPagination: ({
    page,
    onPageChange,
  }: {
    page: number;
    onPageChange: (page: number) => void;
  }) => (
    <button type="button" onClick={() => onPageChange(page + 1)}>
      Dashboard next page
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transactions = {
    data: { page: 1, totalPages: 3, totalItems: 21, items: [] },
    error: null,
    isPending: false,
    refetch: mocks.transactionRefetch,
  };
  mocks.summary = {
    data: { balance: "100.00", income: "182.40", expense: "82.40" },
    error: null,
    isPending: false,
    refetch: mocks.summaryRefetch,
  };
});

describe("DashboardPage", () => {
  it("formats the monthly summary and changes the page query from the pager", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$182.40")).toBeInTheDocument();
    expect(screen.getByText("$82.40")).toBeInTheDocument();
    expect(screen.getByText("21 total")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dashboard next page" }));
    expect(mocks.transactionOptions).toHaveBeenLastCalledWith({ page: 2 });
  });

  it("clamps a page that disappears before committing an empty result", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardPage />);
    await user.click(screen.getByRole("button", { name: "Dashboard next page" }));

    mocks.transactions = {
      data: { page: 2, totalPages: 1, totalItems: 8, items: [] },
      error: null,
      isPending: false,
      refetch: mocks.transactionRefetch,
    };
    rerender(<DashboardPage />);

    await waitFor(() => expect(mocks.transactionOptions).toHaveBeenLastCalledWith({ page: 1 }));
  });

  it("shows an ordinary summary failure and retries it", async () => {
    const user = userEvent.setup();
    mocks.summary = {
      data: undefined,
      error: new ApiError(503, "Summary unavailable"),
      isPending: false,
      refetch: mocks.summaryRefetch,
    };

    render(<DashboardPage />);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Summary unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(mocks.summaryRefetch).toHaveBeenCalledTimes(1);
  });
});
