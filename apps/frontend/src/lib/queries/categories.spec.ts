import { API_ROUTES } from "@expense-tracker/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  categoriesQueryKey,
  categoriesQueryOptions,
  createCategory,
  deleteCategory,
  updateCategory,
} from "./categories";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api-client", () => ({
  apiClient: mocks,
  retryApiQuery: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("category queries", () => {
  it("uses the shared list key and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    mocks.get.mockResolvedValue([]);

    await (
      categoriesQueryOptions.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>
    )({
      signal,
    });

    expect(categoriesQueryOptions.queryKey).toEqual(categoriesQueryKey);
    expect(mocks.get).toHaveBeenCalledWith(API_ROUTES.categories.root, { signal });
  });

  it("posts category creation to the collection route", async () => {
    const input = { name: "Groceries", color: "#22c55e", icon: "🛒" };
    mocks.post.mockResolvedValue({});

    await createCategory(input);

    expect(mocks.post).toHaveBeenCalledWith(API_ROUTES.categories.root, input);
  });

  it("patches and deletes the id-specific shared route", async () => {
    const id = "018f0000-0000-7000-8000-0000000000aa";
    const input = { name: "Food" };
    mocks.patch.mockResolvedValue({});
    mocks.delete.mockResolvedValue(undefined);

    await updateCategory({ id, input });
    await deleteCategory(id);

    expect(mocks.patch).toHaveBeenCalledWith(API_ROUTES.categories.byId(id), input);
    expect(mocks.delete).toHaveBeenCalledWith(API_ROUTES.categories.byId(id));
  });
});
