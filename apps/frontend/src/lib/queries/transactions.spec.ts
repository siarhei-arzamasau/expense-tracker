import { describe, expect, it } from "vitest";

import { compactQuery, serializeQuery, transactionQueryKeys } from "./transactions";

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
