// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TransactionsPage from "./page";

const CATEGORY_ID = "8f16b2b6-f717-4e3d-a59b-f6c284874f0e";
const STALE_CATEGORY_ID = "36a7d63d-4c1c-4ca3-8f75-e593e3b205af";

const mocks = vi.hoisted(() => ({
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
  transactionRefetch: vi.fn(),
  transactionQueryInputs: [] as unknown[],
  transactions: {} as {
    data?: { page: number; totalPages: number; totalItems: number; items: unknown[] };
    error: Error | null;
    isPending: boolean;
    refetch: () => unknown;
  },
  categories: {} as {
    data?: Array<{ id: string; name: string; icon: string | null }>;
    error: Error | null;
    isPending: boolean;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { kind: string; query?: unknown }) => {
    if (options.kind === "transactions") {
      mocks.transactionQueryInputs.push(options.query);
      return mocks.transactions;
    }
    return mocks.categories;
  },
}));
vi.mock("@/lib/queries/transactions", () => ({
  transactionsQueryOptions: (query: unknown) => ({ kind: "transactions", query }),
}));
vi.mock("@/lib/queries/categories", () => ({
  categoriesQueryOptions: { kind: "categories" },
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
      History next page
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transactionQueryInputs = [];
  mocks.search = "";
  mocks.transactions = {
    data: { page: 1, totalPages: 3, totalItems: 21, items: [] },
    error: null,
    isPending: false,
    refetch: mocks.transactionRefetch,
  };
  mocks.categories = {
    data: [{ id: CATEGORY_ID, name: "Groceries", icon: "🛒" }],
    error: null,
    isPending: false,
  };
});

describe("TransactionsPage", () => {
  it("trims search input, returns to page 1, and preserves the other filters", async () => {
    mocks.search = `page=3&search=old&type=EXPENSE&categoryId=${CATEGORY_ID}`;
    mocks.transactions.data = { page: 3, totalPages: 3, totalItems: 21, items: [] };
    const user = userEvent.setup();
    render(<TransactionsPage />);

    const search = screen.getByLabelText("Search descriptions");
    await user.clear(search);
    await user.type(search, "  lunch  ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(mocks.push).toHaveBeenCalledWith(
      `/transactions?search=lunch&type=EXPENSE&categoryId=${CATEGORY_ID}`,
    );
  });

  it("updates selects from the address bar and clears all active filters", async () => {
    mocks.search = `search=lunch&type=EXPENSE&categoryId=${CATEGORY_ID}`;
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await user.selectOptions(screen.getByLabelText("Type"), "INCOME");
    expect(mocks.push).toHaveBeenCalledWith(
      `/transactions?search=lunch&type=INCOME&categoryId=${CATEGORY_ID}`,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/transactions");
    expect(screen.getByText("No transactions match these filters.")).toBeInTheDocument();
  });

  it("does not forward a stale category id that is absent from the current list", () => {
    mocks.search = `categoryId=${STALE_CATEGORY_ID}`;

    render(<TransactionsPage />);

    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(mocks.transactionQueryInputs).toContainEqual({ page: 1, categoryId: undefined });
  });

  it("clamps an out-of-range URL page with replace", async () => {
    mocks.search = "page=5";
    mocks.transactions.data = { page: 5, totalPages: 2, totalItems: 12, items: [] };

    render(<TransactionsPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/transactions?page=2"));
  });

  it("writes pagination back to the URL", async () => {
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await user.click(screen.getByRole("button", { name: "History next page" }));

    expect(mocks.push).toHaveBeenCalledWith("/transactions?page=2");
  });
});
