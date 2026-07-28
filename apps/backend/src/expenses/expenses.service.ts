import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ExpenseDto } from "@expense-tracker/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateExpenseDto } from "./dto/create-expense.dto";
import type { UpdateExpenseDto } from "./dto/update-expense.dto";

interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

interface ExpenseRecord {
  id: string;
  /** Prisma's Decimal. toFixed comes from decimal.js. */
  amount: { toFixed: (decimalPlaces: number) => string };
  description: string | null;
  spentAt: Date;
  categoryId: string | null;
  category: CategoryRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<ExpenseDto[]> {
    const expenses = await this.prisma.expense.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { spentAt: "desc" },
    });
    return expenses.map((expense) => this.toDto(expense));
  }

  async findOne(userId: string, id: string): Promise<ExpenseDto> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!expense) {
      throw new NotFoundException("Expense not found");
    }
    return this.toDto(expense);
  }

  async create(userId: string, dto: CreateExpenseDto): Promise<ExpenseDto> {
    await this.assertCategoryBelongsToUser(userId, dto.categoryId);

    const expense = await this.prisma.expense.create({
      data: {
        // toFixed(2) hands Prisma an exact decimal string. Passing the raw
        // JS number would round-trip through a binary float first.
        amount: dto.amount.toFixed(2),
        description: dto.description ?? null,
        spentAt: new Date(dto.spentAt),
        categoryId: dto.categoryId ?? null,
        userId,
      },
      include: { category: true },
    });
    return this.toDto(expense);
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto): Promise<ExpenseDto> {
    // Confirms ownership before we write anything.
    await this.findOne(userId, id);
    await this.assertCategoryBelongsToUser(userId, dto.categoryId);

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount.toFixed(2) }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.spentAt !== undefined && { spentAt: new Date(dto.spentAt) }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: true },
    });
    return this.toDto(expense);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.expense.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException("Expense not found");
    }
  }

  /**
   * Without this, a user could attach their expense to someone else's category
   * id and read that category's name back out.
   */
  private async assertCategoryBelongsToUser(
    userId: string,
    categoryId: string | undefined,
  ): Promise<void> {
    if (!categoryId) {
      return;
    }
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new BadRequestException("Unknown category");
    }
  }

  private toDto(expense: ExpenseRecord): ExpenseDto {
    return {
      id: expense.id,
      // Decimal -> string on purpose. See ExpenseDto in @expense-tracker/shared.
      // toFixed(2), not toString(): Decimal.toString() drops trailing zeros, so
      // 82.40 would go out as "82.4" and the API would be inconsistent about
      // how many decimal places a money value has.
      amount: expense.amount.toFixed(2),
      description: expense.description,
      spentAt: expense.spentAt.toISOString(),
      categoryId: expense.categoryId,
      category: expense.category
        ? {
            id: expense.category.id,
            name: expense.category.name,
            color: expense.category.color,
            createdAt: expense.category.createdAt.toISOString(),
          }
        : null,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }
}
