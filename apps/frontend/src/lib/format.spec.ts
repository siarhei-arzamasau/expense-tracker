import { describe, expect, it } from "vitest";

import { flowShares, formatAmount, formatDate, formatShare } from "./format";

describe("formatAmount", () => {
  it("formats the API decimal string only at the display boundary", () => {
    expect(formatAmount("82.40")).toBe("$82.40");
    expect(formatAmount("82.40", "EUR")).toBe("€82.40");
  });

  it("returns a non-numeric value unchanged", () => {
    expect(formatAmount("not-a-number")).toBe("not-a-number");
  });
});

describe("flowShares", () => {
  it("splits the month between money in and money out", () => {
    const shares = flowShares("182.40", "82.40");

    expect(shares.income).toBeCloseTo(182.4 / 264.8);
    expect(shares.expense).toBeCloseTo(82.4 / 264.8);
    expect(shares.income + shares.expense).toBeCloseTo(1);
  });

  it("reports an empty month as no flow at all rather than dividing by zero", () => {
    expect(flowShares("0.00", "0.00")).toEqual({ income: 0, expense: 0 });
    expect(flowShares("not-a-number", "82.40")).toEqual({ income: 0, expense: 0 });
  });
});

describe("formatShare", () => {
  it("rounds a fraction to whole percent", () => {
    expect(formatShare(0.5824)).toBe("58%");
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(1)).toBe("100%");
  });
});

describe("formatDate", () => {
  it("keeps a UTC calendar day stable at midnight", () => {
    expect(formatDate("2026-07-01T00:00:00.000Z")).toBe("Jul 1, 2026");
  });
});
