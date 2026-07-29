// @vitest-environment jsdom
import type { CategoryListItemDto } from "@expense-tracker/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CategoriesPage from "./page";

/**
 * The one rule this page owns that nothing else can enforce: every category
 * mutation invalidates `["transactions"]` as well as `["categories"]`.
 * `TransactionDto` embeds a snapshot of its category, so dropping the second
 * invalidation leaves a renamed or recoloured category rendering stale in the
 * transactions table — with no type error, no lint error, and no failing test
 * anywhere else in the repository.
 *
 * The network is mocked at the query module, so nothing here proves the
 * requests themselves are well-formed; the backend specs own that end. What is
 * being checked is the wiring between a successful mutation and the cache.
 */
const mocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("@/lib/queries/categories", () => ({
  categoriesQueryOptions: { queryKey: ["categories"], queryFn: mocks.listCategories },
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  deleteCategory: mocks.deleteCategory,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const GROCERIES: CategoryListItemDto = {
  id: "018f0000-0000-7000-8000-0000000000aa",
  name: "Groceries",
  color: "#22c55e",
  icon: "🛒",
  createdAt: "2026-07-01T12:00:00.000Z",
  transactionCount: 3,
};

const RENT: CategoryListItemDto = {
  id: "018f0000-0000-7000-8000-0000000000bb",
  name: "Rent",
  color: null,
  icon: null,
  createdAt: "2026-07-01T12:00:00.000Z",
  transactionCount: 1,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <CategoriesPage />
    </QueryClientProvider>,
  );

  return { invalidateQueries, user: userEvent.setup() };
}

/**
 * The row card for one category, used to scope queries to a single entry.
 * Anchored on `data-slot` rather than on a Tailwind class: the row's styling is
 * free to change, its identity is not.
 */
function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest("[data-slot=category-row]") as HTMLElement;
}

/**
 * The add and edit forms render identical controls, so a query has to be scoped
 * to one <form>: an unscoped `getByRole("button", { name: "No color" })` finds
 * both the moment an edit form is open. Each form is identified by its own
 * submit button.
 */
function formWithSubmit(label: string): HTMLElement {
  return screen.getByRole("button", { name: label }).closest("form") as HTMLElement;
}

/**
 * React Query hands `mutationFn` a second context argument (`{ client }`), so
 * `toHaveBeenCalledWith(input)` never matches however right the input is. The
 * payload the page built is argument one, and that is the whole contract here.
 */
function firstArgOf(spy: { mock: { calls: unknown[][] } }): unknown {
  return spy.mock.calls[0]?.[0];
}

function invalidatedKeys(spy: { mock: { calls: unknown[][] } }): unknown[] {
  return spy.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listCategories.mockResolvedValue([GROCERIES, RENT]);
  mocks.createCategory.mockResolvedValue({
    ...GROCERIES,
    id: "018f0000-0000-7000-8000-0000000000cc",
  });
  mocks.updateCategory.mockResolvedValue(GROCERIES);
  mocks.deleteCategory.mockResolvedValue(undefined);
});

describe("CategoriesPage", () => {
  describe("cache invalidation", () => {
    it("invalidates transactions as well as categories after a create", async () => {
      const { invalidateQueries, user } = renderPage();
      await screen.findByText("Groceries");

      const form = formWithSubmit("Add category");
      await user.type(within(form).getByLabelText("Name"), "Coffee");
      await user.click(within(form).getByRole("button", { name: "Add category" }));

      await waitFor(() => expect(mocks.createCategory).toHaveBeenCalled());
      await waitFor(() =>
        expect(invalidatedKeys(invalidateQueries)).toEqual(
          expect.arrayContaining([["categories"], ["transactions"]]),
        ),
      );
    });

    it("invalidates transactions as well as categories after an update", async () => {
      const { invalidateQueries, user } = renderPage();
      await screen.findByText("Groceries");

      await user.click(within(rowFor("Groceries")).getByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(mocks.updateCategory).toHaveBeenCalled());
      await waitFor(() =>
        expect(invalidatedKeys(invalidateQueries)).toEqual(
          expect.arrayContaining([["categories"], ["transactions"]]),
        ),
      );
    });

    it("invalidates transactions as well as categories after a delete", async () => {
      const { invalidateQueries, user } = renderPage();
      await screen.findByText("Rent");

      await user.click(within(rowFor("Rent")).getByRole("button", { name: "Delete" }));
      await user.click(await screen.findByRole("button", { name: "Delete category" }));

      await waitFor(() => expect(firstArgOf(mocks.deleteCategory)).toBe(RENT.id));
      await waitFor(() =>
        expect(invalidatedKeys(invalidateQueries)).toEqual(
          expect.arrayContaining([["categories"], ["transactions"]]),
        ),
      );
    });
  });

  describe("null handling on submit", () => {
    // Create and update treat a cleared colour differently on purpose. On
    // create, omitting the key and sending null mean the same thing, so the key
    // is dropped; on update, null is what clears the stored column, while an
    // omitted key would instead mean "leave it alone".
    it("omits a cleared colour on create rather than sending null", async () => {
      const { user } = renderPage();
      await screen.findByText("Groceries");

      const form = formWithSubmit("Add category");
      await user.type(within(form).getByLabelText("Name"), "Coffee");
      await user.click(within(form).getByRole("button", { name: "No color" }));
      await user.click(within(form).getByRole("button", { name: "Add category" }));

      await waitFor(() => expect(firstArgOf(mocks.createCategory)).toEqual({ name: "Coffee" }));
    });

    it("sends null on update, which is what clears the colour", async () => {
      const { user } = renderPage();
      await screen.findByText("Groceries");

      await user.click(within(rowFor("Groceries")).getByRole("button", { name: "Edit" }));
      const form = formWithSubmit("Save changes");
      await user.click(within(form).getByRole("button", { name: "No color" }));
      await user.click(within(form).getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(firstArgOf(mocks.updateCategory)).toEqual({
          id: GROCERIES.id,
          input: { name: "Groceries", color: null, icon: "🛒" },
        }),
      );
    });
  });

  describe("search", () => {
    // Filtering happens client-side against the already-cached collection,
    // unlike the transactions list whose filters are server-side and
    // page-aware. Refetching here would be the bug.
    it("narrows the list by name without refetching", async () => {
      const { user } = renderPage();
      await screen.findByText("Groceries");

      await user.type(screen.getByLabelText("Search"), "rent");

      expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
      expect(screen.getByText("Rent")).toBeInTheDocument();
      expect(mocks.listCategories).toHaveBeenCalledTimes(1);
    });

    it("reports an empty search differently from an empty account", async () => {
      const { user } = renderPage();
      await screen.findByText("Groceries");

      await user.type(screen.getByLabelText("Search"), "zzz");

      expect(screen.getByText("No categories match your search.")).toBeInTheDocument();
    });
  });

  describe("transaction counts", () => {
    it("singularises a count of one", async () => {
      renderPage();
      await screen.findByText("Rent");

      expect(within(rowFor("Rent")).getByText("1 transaction")).toBeInTheDocument();
      expect(within(rowFor("Groceries")).getByText("3 transactions")).toBeInTheDocument();
    });
  });
});
