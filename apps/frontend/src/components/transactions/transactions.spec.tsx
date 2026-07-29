// @vitest-environment jsdom
import type {
  CategoryListItemDto,
  PaginatedResponse,
  TransactionDto,
} from "@expense-tracker/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { categoriesQueryKey } from "@/lib/queries/categories";
import { transactionQueryKeys } from "@/lib/queries/transactions";
import { AddTransactionDialog, TransactionList, TransactionPagination } from "./index";

const mocks = vi.hoisted(() => ({ createTransaction: vi.fn() }));

vi.mock("@/lib/queries/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries/transactions")>();
  return { ...actual, createTransaction: mocks.createTransaction };
});

const CATEGORY: CategoryListItemDto = {
  id: "018f0000-0000-7000-8000-0000000000aa",
  name: "Groceries",
  color: "#22c55e",
  icon: "🛒",
  createdAt: "2026-07-01T12:00:00.000Z",
  transactionCount: 2,
};

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { invalidateQueries, user: userEvent.setup() };
}

function firstArgOf(spy: { mock: { calls: unknown[][] } }): unknown {
  return spy.mock.calls[0]?.[0];
}

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTransaction.mockResolvedValue({});
});

describe("AddTransactionDialog", () => {
  it("explains the category prerequisite and disables submission", async () => {
    const { user } = renderWithQuery(<AddTransactionDialog categories={[]} />);

    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(
      screen.getByText("You need a category before you can add a transaction."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a category" })).toHaveAttribute(
      "href",
      "/categories",
    );
    expect(screen.getByRole("button", { name: "Add transaction" })).toBeDisabled();
  });

  it("normalizes the request and invalidates every dependent cache", async () => {
    const { invalidateQueries, user } = renderWithQuery(
      <AddTransactionDialog categories={[CATEGORY]} triggerLabel="Record transaction" />,
    );

    await user.click(screen.getByRole("button", { name: "Record transaction" }));
    await user.selectOptions(screen.getByLabelText("Type"), "INCOME");
    await user.type(screen.getByLabelText("Amount"), "82.40");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-07-01" } });
    await user.type(screen.getByLabelText(/Description/), "  Salary  ");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() =>
      expect(firstArgOf(mocks.createTransaction)).toEqual({
        type: "INCOME",
        amount: 82.4,
        categoryId: CATEGORY.id,
        date: "2026-07-01T00:00:00.000Z",
        description: "Salary",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(invalidateQueries.mock.calls.map(([filters]) => filters)).toEqual(
      expect.arrayContaining([
        { queryKey: transactionQueryKeys.lists() },
        { queryKey: transactionQueryKeys.summaries() },
        { queryKey: categoriesQueryKey },
      ]),
    );
  });

  it("rejects a non-positive amount before the mutation", async () => {
    const { user } = renderWithQuery(<AddTransactionDialog categories={[CATEGORY]} />);

    await user.click(screen.getByRole("button", { name: "Add transaction" }));
    await user.type(screen.getByLabelText("Amount"), "0");
    await user.click(screen.getByRole("button", { name: "Add transaction" }));

    expect(await screen.findByText("Amount must be greater than zero")).toBeInTheDocument();
    expect(mocks.createTransaction).not.toHaveBeenCalled();
  });
});

function transaction(overrides: Partial<TransactionDto> = {}): TransactionDto {
  const base: TransactionDto = {
    id: "018f0000-0000-7000-8000-0000000000bb",
    type: "EXPENSE",
    amount: "82.40",
    description: null,
    date: "2026-07-01T00:00:00.000Z",
    categoryId: CATEGORY.id,
    category: {
      id: CATEGORY.id,
      name: CATEGORY.name,
      color: CATEGORY.color,
      icon: CATEGORY.icon,
      createdAt: CATEGORY.createdAt,
    },
    createdAt: "2026-07-01T12:00:00.000Z",
  };

  return { ...base, ...overrides } as TransactionDto;
}

function page(items: TransactionDto[]): PaginatedResponse<TransactionDto> {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: items.length ? 1 : 0,
  };
}

describe("TransactionList", () => {
  it("renders an accessible loading skeleton", () => {
    render(<TransactionList data={undefined} isPending error={null} onRetry={vi.fn()} />);
    expect(screen.getByLabelText("Loading transactions")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps a protected 401 silent while the global redirect runs", () => {
    const { container } = render(
      <TransactionList
        data={undefined}
        isPending={false}
        error={new ApiError(401, "Unauthorized")}
        onRetry={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an API error and retries on demand", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <TransactionList
        data={undefined}
        isPending={false}
        error={new ApiError(503, "Service unavailable")}
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses the caller's empty-state explanation", () => {
    render(
      <TransactionList
        data={page([])}
        isPending={false}
        error={null}
        onRetry={vi.fn()}
        emptyMessage="No filtered transactions."
      />,
    );
    expect(screen.getByText("No filtered transactions.")).toBeInTheDocument();
  });

  it("renders signed, formatted amounts and category fallbacks in both layouts", () => {
    const income = transaction({ type: "INCOME", description: "Salary" });
    const expense = transaction({
      id: "018f0000-0000-7000-8000-0000000000cc",
      category: {
        id: "category-2",
        name: "Rent",
        color: "#ef4444",
        icon: null,
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    });

    render(
      <TransactionList
        data={page([income, expense])}
        isPending={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getAllByText("+$82.40")).toHaveLength(2);
    expect(screen.getAllByText("−$82.40")).toHaveLength(2);
    expect(screen.getAllByText("Salary")).toHaveLength(2);
    expect(screen.getAllByText("Transaction")).toHaveLength(1);
    expect(screen.getAllByText("Rent")).toHaveLength(2);
  });
});

describe("TransactionPagination", () => {
  it.each([0, 1])("renders nothing for %s total pages", (totalPages) => {
    const { container } = render(
      <TransactionPagination page={1} totalPages={totalPages} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("moves within bounds and disables the unavailable direction", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <TransactionPagination page={1} totalPages={3} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole("button", { name: "Go to previous transaction page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Go to next transaction page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    rerender(<TransactionPagination page={3} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "Go to next transaction page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Go to previous transaction page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
