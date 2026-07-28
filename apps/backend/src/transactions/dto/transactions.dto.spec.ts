import { validate } from "class-validator";

import { CreateTransactionDto } from "./create-transaction.dto";
import { FindTransactionsQueryDto } from "./find-transactions-query.dto";

const CATEGORY_ID = "018f0000-0000-7000-8000-0000000000cc";

describe("Transaction DTO validation", () => {
  it("accepts a valid transaction creation request", async () => {
    const dto = Object.assign(new CreateTransactionDto(), {
      amount: 42.5,
      type: "EXPENSE",
      description: "Weekly shop",
      date: "2026-07-28T00:00:00.000Z",
      categoryId: CATEGORY_ID,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects a missing category and an amount with excess precision", async () => {
    const dto = Object.assign(new CreateTransactionDto(), {
      amount: 10.005,
      type: "EXPENSE",
      date: "2026-07-28T00:00:00.000Z",
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["amount", "categoryId"]),
    );
  });

  it("accepts the first page with a bounded search term", async () => {
    const dto = Object.assign(new FindTransactionsQueryDto(), {
      page: 1,
      search: "groceries",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects page zero and an overlong search term", async () => {
    const dto = Object.assign(new FindTransactionsQueryDto(), {
      page: 0,
      search: "x".repeat(256),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["page", "search"]),
    );
  });

  // The cap exists so one request cannot buy an arbitrarily deep SQL OFFSET.
  it("accepts the last allowed page and rejects the one past it", async () => {
    const allowed = Object.assign(new FindTransactionsQueryDto(), { page: 10_000 });
    const tooDeep = Object.assign(new FindTransactionsQueryDto(), { page: 10_001 });

    await expect(validate(allowed)).resolves.toHaveLength(0);
    await expect(validate(tooDeep)).resolves.toEqual([
      expect.objectContaining({ property: "page" }),
    ]);
  });
});
