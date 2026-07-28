import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { CategoriesService } from "./categories.service";

function createPrismaMock() {
  return {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

const USER_ID = "018f0000-0000-7000-8000-000000000001";
const CATEGORY_ID = "018f0000-0000-7000-8000-0000000000aa";

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    name: "Groceries",
    color: "#22c55e",
    icon: "🛒",
    userId: USER_ID,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("CategoriesService", () => {
  let service: CategoriesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CategoriesService);
  });

  describe("findAll", () => {
    it("maps Prisma's relation count to expenseCount", async () => {
      prisma.category.findMany.mockResolvedValue([{ ...categoryRow(), _count: { expenses: 12 } }]);

      const [category] = await service.findAll(USER_ID);

      expect(category).toMatchObject({
        id: CATEGORY_ID,
        icon: "🛒",
        expenseCount: 12,
      });
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          include: { _count: { select: { expenses: true } } },
        }),
      );
    });
  });

  describe("update", () => {
    it("rejects a name used by another category", async () => {
      prisma.category.findFirst.mockResolvedValue(categoryRow());
      prisma.category.findUnique.mockResolvedValue(
        categoryRow({ id: "018f0000-0000-7000-8000-0000000000bb", name: "Dining" }),
      );

      await expect(service.update(USER_ID, CATEGORY_ID, { name: "Dining" })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it("allows saving an unchanged name", async () => {
      const current = categoryRow();
      prisma.category.findFirst.mockResolvedValue(current);
      prisma.category.findUnique.mockResolvedValue(current);
      prisma.category.update.mockResolvedValue(current);

      await expect(
        service.update(USER_ID, CATEGORY_ID, { name: "Groceries" }),
      ).resolves.toMatchObject({ name: "Groceries" });
    });

    it("returns 404 for another user's category", async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, CATEGORY_ID, { color: "#ef4444" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it("only writes fields included in a partial update", async () => {
      prisma.category.findFirst.mockResolvedValue(categoryRow());
      prisma.category.update.mockResolvedValue(categoryRow({ color: null }));

      await service.update(USER_ID, CATEGORY_ID, { color: null });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
        data: { color: null },
      });
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });
  });
});
