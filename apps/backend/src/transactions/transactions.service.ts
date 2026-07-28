import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@expense-tracker/database";
import type {
  PaginatedResponse,
  TransactionDto,
  TransactionSummaryDto,
  TransactionType,
} from "@expense-tracker/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateTransactionDto } from "./dto/create-transaction.dto";
import type { FindTransactionsQueryDto } from "./dto/find-transactions-query.dto";
import type { UpdateTransactionDto } from "./dto/update-transaction.dto";

const TRANSACTIONS_PAGE_SIZE = 10;

interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: Date;
}

interface TransactionRecord {
  id: string;
  /** Prisma's Decimal. toFixed comes from decimal.js. */
  amount: { toFixed: (decimalPlaces: number) => string };
  type: TransactionType;
  description: string | null;
  date: Date;
  categoryId: string;
  category: CategoryRecord;
  createdAt: Date;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    query: FindTransactionsQueryDto,
  ): Promise<PaginatedResponse<TransactionDto>> {
    const { type, categoryId, dateFrom, dateTo, search } = query;
    const page = query.page ?? 1;

    const where = {
      userId,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(search && { description: { contains: search, mode: "insensitive" as const } }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    } satisfies Prisma.TransactionWhereInput;

    const [totalItems, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (page - 1) * TRANSACTIONS_PAGE_SIZE,
        take: TRANSACTIONS_PAGE_SIZE,
      }),
    ]);

    return {
      items: transactions.map((transaction) => this.toDto(transaction)),
      page,
      pageSize: TRANSACTIONS_PAGE_SIZE,
      totalItems,
      totalPages: Math.ceil(totalItems / TRANSACTIONS_PAGE_SIZE),
    };
  }

  async summary(userId: string, month: number, year: number): Promise<TransactionSummaryDto> {
    // Half-open UTC range: an `lte` on end-of-month would lose the last day's rows.
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const groups = await this.prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    });

    // groupBy omits absent groups — a month with no income returns one row, not two.
    const sums: Record<TransactionType, string> = { INCOME: "0.00", EXPENSE: "0.00" };
    for (const group of groups) {
      sums[group.type] = group._sum.amount?.toFixed(2) ?? "0.00";
    }

    const incomeCents = Math.round(Number(sums.INCOME) * 100);
    const expenseCents = Math.round(Number(sums.EXPENSE) * 100);
    const balance = ((incomeCents - expenseCents) / 100).toFixed(2);

    return { month, year, income: sums.INCOME, expense: sums.EXPENSE, balance };
  }

  async findOne(userId: string, id: string): Promise<TransactionDto> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }
    return this.toDto(transaction);
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    await this.assertCategoryBelongsToUser(userId, dto.categoryId);

    const transaction = await this.prisma.transaction.create({
      data: {
        // toFixed(2) hands Prisma an exact decimal string. Passing the raw
        // JS number would round-trip through a binary float first.
        amount: dto.amount.toFixed(2),
        type: dto.type,
        description: dto.description ?? null,
        date: new Date(dto.date),
        categoryId: dto.categoryId,
        userId,
      },
      include: { category: true },
    });
    return this.toDto(transaction);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    // Confirms ownership before we write anything.
    await this.findOne(userId, id);
    await this.assertCategoryBelongsToUser(userId, dto.categoryId);

    const transaction = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount.toFixed(2) }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      },
      include: { category: true },
    });
    return this.toDto(transaction);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.transaction.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException("Transaction not found");
    }
  }

  /**
   * Without this, a user could attach their transaction to someone else's
   * category id and read that category's name back out.
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

  private toDto(transaction: TransactionRecord): TransactionDto {
    return {
      id: transaction.id,
      // Decimal -> string on purpose. See TransactionDto in @expense-tracker/shared.
      // toFixed(2), not toString(): Decimal.toString() drops trailing zeros, so
      // 82.40 would go out as "82.4" and the API would be inconsistent about
      // how many decimal places a money value has.
      amount: transaction.amount.toFixed(2),
      type: transaction.type,
      description: transaction.description,
      date: transaction.date.toISOString(),
      categoryId: transaction.categoryId,
      category: {
        id: transaction.category.id,
        name: transaction.category.name,
        color: transaction.category.color,
        icon: transaction.category.icon,
        createdAt: transaction.category.createdAt.toISOString(),
      },
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
