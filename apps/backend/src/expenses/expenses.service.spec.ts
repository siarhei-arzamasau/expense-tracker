import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { ExpensesService } from "./expenses.service";

/** Minimal in-memory stand-in — these tests never touch Postgres. */
function createPrismaMock() {
  return {
    expense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
  };
}

const USER_ID = "018f0000-0000-7000-8000-000000000001";

function expenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "018f0000-0000-7000-8000-0000000000aa",
    amount: "42.50",
    description: "Weekly shop",
    spentAt: new Date("2026-07-01T12:00:00.000Z"),
    categoryId: null,
    category: null,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("ExpensesService", () => {
  let service: ExpensesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [ExpensesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ExpensesService);
  });

  describe("findAll", () => {
    it("serializes Decimal amounts as strings", async () => {
      prisma.expense.findMany.mockResolvedValue([expenseRow()]);

      const [expense] = await service.findAll(USER_ID);

      expect(expense?.amount).toBe("42.50");
      expect(typeof expense?.amount).toBe("string");
    });

    it("scopes the query to the requesting user", async () => {
      prisma.expense.findMany.mockResolvedValue([]);

      await service.findAll(USER_ID);

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
    });
  });

  describe("create", () => {
    it("passes an exact 2dp decimal string to Prisma, not a float", async () => {
      prisma.expense.create.mockResolvedValue(expenseRow({ amount: "0.30" }));

      await service.create(USER_ID, { amount: 0.3, spentAt: "2026-07-01T12:00:00.000Z" });

      expect(prisma.expense.create).toHaveBeenCalledWith(
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
          spentAt: "2026-07-01T12:00:00.000Z",
          categoryId: "018f0000-0000-7000-8000-0000000000bb",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.expense.create).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("throws when the expense is not the user's", async () => {
      prisma.expense.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.remove(USER_ID, "018f0000-0000-7000-8000-0000000000cc"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
