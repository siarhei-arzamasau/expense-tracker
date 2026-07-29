import { describe, expect, it } from "vitest";

import { formatAmount, formatDate } from "./format";

describe("formatAmount", () => {
  it("formats the API decimal string only at the display boundary", () => {
    expect(formatAmount("82.40")).toBe("$82.40");
    expect(formatAmount("82.40", "EUR")).toBe("€82.40");
  });

  it("returns a non-numeric value unchanged", () => {
    expect(formatAmount("not-a-number")).toBe("not-a-number");
  });
});

describe("formatDate", () => {
  it("keeps a UTC calendar day stable at midnight", () => {
    expect(formatDate("2026-07-01T00:00:00.000Z")).toBe("Jul 1, 2026");
  });
});
