import { describe, expect, it } from "vitest";

import { hasActiveFilters, readPage, readTransactionQuery } from "./transaction-filters";

describe("readPage", () => {
  it("reads a positive integer", () => {
    expect(readPage("3")).toBe(3);
  });

  it.each([
    ["a missing parameter", null],
    ["an empty string", ""],
    ["a non-numeric value", "abc"],
    ["zero", "0"],
    ["a negative page", "-2"],
    ["a fraction", "1.5"],
    ["Infinity", "Infinity"],
  ])("falls back to page 1 for %s", (_label, value) => {
    expect(readPage(value)).toBe(1);
  });
});

describe("readTransactionQuery", () => {
  const query = (search: string) => readTransactionQuery(new URLSearchParams(search));

  it("defaults to the first page with no filters", () => {
    expect(query("")).toEqual({ page: 1 });
  });

  it("omits filters rather than sending empty values", () => {
    expect(query("search=&type=&categoryId=")).toEqual({ page: 1 });
  });

  it("reads every supported filter", () => {
    expect(query("page=2&search=lunch&type=INCOME&categoryId=abc")).toEqual({
      page: 2,
      search: "lunch",
      type: "INCOME",
      categoryId: "abc",
    });
  });

  it("trims a padded search term", () => {
    expect(query("search=%20%20lunch%20%20")).toEqual({ page: 1, search: "lunch" });
  });

  // The URL is user-editable, so an invalid type must not reach the API and
  // earn a 400 — it means "no type filter".
  it("drops a type outside the enum", () => {
    expect(query("type=TRANSFER")).toEqual({ page: 1 });
    expect(query("type=income")).toEqual({ page: 1 });
  });
});

describe("hasActiveFilters", () => {
  it("does not count paging as a filter", () => {
    expect(hasActiveFilters({ page: 4 })).toBe(false);
  });

  it.each([
    ["search", { search: "lunch" }],
    ["type", { type: "EXPENSE" as const }],
    ["categoryId", { categoryId: "abc" }],
  ])("counts %s", (_label, filter) => {
    expect(hasActiveFilters({ page: 1, ...filter })).toBe(true);
  });
});
