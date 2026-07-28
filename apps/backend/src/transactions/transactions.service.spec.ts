import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { TransactionsService } from "./transactions.service";

/** Minimal in-memory stand-in — these tests never touch Postgres. */
function createPrismaMock() {
  return {
    transaction: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      groupBy: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
  };
}

const USER_ID = "018f0000-0000-7000-8000-000000000001";
const CATEGORY_ID = "018f0000-0000-7000-8000-0000000000cc";

/**
 * Stand-in for Prisma's Decimal. The service only calls toFixed, and using a
 * plain string here would let a regression to `.toString()` pass unnoticed.
 */
function decimal(value: string) {
  return { toFixed: (decimalPlaces: number) => Number(value).toFixed(decimalPlaces) };
}

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    name: "Groceries",
    color: "#22c55e",
    icon: "🛒",
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

function transactionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "018f0000-0000-7000-8000-0000000000aa",
    amount: decimal("42.50"),
    type: "EXPENSE",
    description: "Weekly shop",
    date: new Date("2026-07-01T12:00:00.000Z"),
    categoryId: CATEGORY_ID,
    category: categoryRow(),
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("TransactionsService", () => {
  let service: TransactionsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.transaction.count.mockResolvedValue(0);
    prisma.transaction.findMany.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [TransactionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(TransactionsService);
  });

  describe("findAll", () => {
    it("serializes Decimal amounts as strings", async () => {
      prisma.transaction.count.mockResolvedValue(1);
      prisma.transaction.findMany.mockResolvedValue([transactionRow()]);

      const { items } = await service.findAll(USER_ID, {});
      const [transaction] = items;

      expect(transaction?.amount).toBe("42.50");
      expect(typeof transaction?.amount).toBe("string");
    });

    it("keeps trailing zeros — 82.40 must not serialize as '82.4'", async () => {
      prisma.transaction.count.mockResolvedValue(1);
      prisma.transaction.findMany.mockResolvedValue([transactionRow({ amount: decimal("82.40") })]);

      const { items } = await service.findAll(USER_ID, {});
      const [transaction] = items;

      expect(transaction?.amount).toBe("82.40");
    });

    it("scopes the query to the requesting user with no extra filters", async () => {
      await service.findAll(USER_ID, {});

      expect(prisma.transaction.count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          skip: 0,
          take: 10,
          orderBy: [{ date: "desc" }, { id: "desc" }],
        }),
      );
    });

    it("uses the requested page to calculate the ten-item offset", async () => {
      const result = await service.findAll(USER_ID, { page: 3 });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it("composes search, type, category and date filters identically for count and rows", async () => {
      await service.findAll(USER_ID, {
        search: "Lunch",
        type: "INCOME",
        categoryId: CATEGORY_ID,
        dateFrom: "2026-07-01T00:00:00.000Z",
        dateTo: "2026-07-31T00:00:00.000Z",
      });

      const expectedWhere = {
        userId: USER_ID,
        type: "INCOME",
        categoryId: CATEGORY_ID,
        description: { contains: "Lunch", mode: "insensitive" },
        date: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lte: new Date("2026-07-31T00:00:00.000Z"),
        },
      };

      expect(prisma.transaction.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("calculates total pages and returns complete metadata", async () => {
      prisma.transaction.count.mockResolvedValue(21);
      prisma.transaction.findMany.mockResolvedValue([transactionRow()]);

      const result = await service.findAll(USER_ID, { page: 2 });

      expect(result).toEqual({
        items: [expect.objectContaining({ id: "018f0000-0000-7000-8000-0000000000aa" })],
        page: 2,
        pageSize: 10,
        totalItems: 21,
        totalPages: 3,
      });
    });

    it("returns an empty page with valid metadata when the page is out of range", async () => {
      prisma.transaction.count.mockResolvedValue(12);

      const result = await service.findAll(USER_ID, { page: 4 });

      expect(result).toEqual({
        items: [],
        page: 4,
        pageSize: 10,
        totalItems: 12,
        totalPages: 2,
      });
    });

    it("returns zero total pages for an empty result set", async () => {
      await expect(service.findAll(USER_ID, {})).resolves.toEqual({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      });
    });
  });

  describe("summary", () => {
    it("uses a half-open UTC month range", async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await service.summary(USER_ID, 7, 2026);

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER_ID,
            date: {
              gte: new Date(Date.UTC(2026, 6, 1)),
              lt: new Date(Date.UTC(2026, 7, 1)),
            },
          },
        }),
      );
    });

    it("defaults a missing group to 0.00 rather than omitting it", async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: "EXPENSE", _sum: { amount: decimal("100.00") } },
      ]);

      const summary = await service.summary(USER_ID, 7, 2026);

      expect(summary).toEqual({
        month: 7,
        year: 2026,
        income: "0.00",
        expense: "100.00",
        balance: "-100.00",
      });
    });

    it("computes balance as income minus expense in integer cents", async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: "INCOME", _sum: { amount: decimal("1000.10") } },
        { type: "EXPENSE", _sum: { amount: decimal("250.05") } },
      ]);

      const summary = await service.summary(USER_ID, 7, 2026);

      expect(summary).toEqual({
        month: 7,
        year: 2026,
        income: "1000.10",
        expense: "250.05",
        balance: "750.05",
      });
    });
  });

  describe("create", () => {
    it("passes an exact 2dp decimal string to Prisma, not a float", async () => {
      prisma.category.findFirst.mockResolvedValue(categoryRow());
      prisma.transaction.create.mockResolvedValue(transactionRow({ amount: decimal("0.30") }));

      await service.create(USER_ID, {
        amount: 0.3,
        type: "EXPENSE",
        date: "2026-07-01T12:00:00.000Z",
        categoryId: CATEGORY_ID,
      });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: "0.30" }),
        }),
      );
    });

    it("rejects a category belonging to another user", async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, {
          amount: 10,
          type: "EXPENSE",
          date: "2026-07-01T12:00:00.000Z",
          categoryId: CATEGORY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("throws when the transaction is not the user's", async () => {
      prisma.transaction.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.remove(USER_ID, "018f0000-0000-7000-8000-0000000000dd"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
