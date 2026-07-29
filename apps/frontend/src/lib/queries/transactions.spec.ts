import { API_ROUTES } from "@expense-tracker/shared";
import { keepPreviousData } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  compactQuery,
  serializeQuery,
  transactionQueryKeys,
  transactionsQueryOptions,
} from "./transactions";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  retryApiQuery: vi.fn(),
}));

vi.mock("../api-client", () => ({
  apiClient: { get: mocks.get },
  retryApiQuery: mocks.retryApiQuery,
}));

beforeEach(() => vi.clearAllMocks());

describe("compactQuery", () => {
  it("drops undefined and empty values", () => {
    expect(compactQuery({ page: 1, search: "", type: undefined, categoryId: "abc" })).toEqual({
      page: 1,
      categoryId: "abc",
    });
  });

  it("keeps page 1 — the API's default is not the same as omitting the key", () => {
    expect(compactQuery({ page: 1 })).toEqual({ page: 1 });
  });
});

describe("serializeQuery", () => {
  it("returns an empty string when nothing is set", () => {
    expect(serializeQuery({})).toBe("");
  });

  it("emits only the filters that survived compaction", () => {
    expect(serializeQuery({ page: 2, search: "", type: "INCOME" })).toBe("?page=2&type=INCOME");
  });

  it("percent-encodes a search term", () => {
    expect(serializeQuery({ search: "coffee & cake" })).toBe("?search=coffee+%26+cake");
  });
});

describe("transactionQueryKeys", () => {
  // Every category mutation invalidates ["transactions"] to refresh the copy of
  // the category embedded in each row, so both lists and summaries must sit
  // under that prefix for the invalidation to reach them.
  it("nests lists and summaries under one root", () => {
    expect(transactionQueryKeys.lists()[0]).toBe("transactions");
    expect(transactionQueryKeys.summaries()[0]).toBe("transactions");
  });

  it("gives equivalent queries the same key", () => {
    expect(transactionQueryKeys.list({ page: 1, search: "" })).toEqual(
      transactionQueryKeys.list({ page: 1 }),
    );
  });

  it("gives different pages different keys", () => {
    expect(transactionQueryKeys.list({ page: 1 })).not.toEqual(
      transactionQueryKeys.list({ page: 2 }),
    );
  });
});

describe("transactionsQueryOptions", () => {
  it("requests the serialized list route and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    const options = transactionsQueryOptions({
      page: 2,
      search: "coffee & cake",
      type: "EXPENSE",
    });
    mocks.get.mockResolvedValue({ items: [], totalItems: 0, page: 2, pageSize: 10, totalPages: 0 });

    await (options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>)({ signal });

    expect(mocks.get).toHaveBeenCalledWith(
      `${API_ROUTES.transactions.root}?page=2&search=coffee+%26+cake&type=EXPENSE`,
      { signal },
    );
  });

  it("uses the shared retry policy and retains the previous page", () => {
    const options = transactionsQueryOptions({ page: 2 });

    expect(options.retry).toBe(mocks.retryApiQuery);
    expect(options.placeholderData).toBe(keepPreviousData);
  });
});
