// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { AddTransactionAction } from "./add-transaction-action";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  queryResult: {} as {
    data?: Array<{ id: string }>;
    error: Error | null;
    isPending: boolean;
    refetch: () => unknown;
  },
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: () => mocks.queryResult }));
vi.mock("@/lib/queries/categories", () => ({ categoriesQueryOptions: {} }));
vi.mock("./add-transaction-dialog", () => ({
  AddTransactionDialog: ({ categories }: { categories: unknown[] }) => (
    <span>Dialog with {categories.length} categories</span>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryResult = { data: [], error: null, isPending: false, refetch: mocks.refetch };
});

describe("AddTransactionAction", () => {
  it("shows an accessible placeholder while categories load", () => {
    mocks.queryResult = { data: undefined, error: null, isPending: true, refetch: mocks.refetch };

    render(<AddTransactionAction />);

    expect(screen.getByLabelText("Loading transaction categories")).toBeInTheDocument();
  });

  it("offers retry for ordinary category failures", async () => {
    const user = userEvent.setup();
    mocks.queryResult = {
      data: undefined,
      error: new ApiError(503, "Unavailable"),
      isPending: false,
      refetch: mocks.refetch,
    };

    render(<AddTransactionAction />);
    await user.click(screen.getByRole("button", { name: "Retry categories" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add transaction is unavailable.");
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while a protected 401 redirects globally", () => {
    mocks.queryResult = {
      data: undefined,
      error: new ApiError(401, "Unauthorized"),
      isPending: false,
      refetch: mocks.refetch,
    };

    const { container } = render(<AddTransactionAction />);

    expect(container).toBeEmptyDOMElement();
  });

  it("hands the complete category list to the dialog", () => {
    mocks.queryResult = {
      data: [{ id: "category-1" }, { id: "category-2" }],
      error: null,
      isPending: false,
      refetch: mocks.refetch,
    };

    render(<AddTransactionAction />);

    expect(screen.getByText("Dialog with 2 categories")).toBeInTheDocument();
  });
});
