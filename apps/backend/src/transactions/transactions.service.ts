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

/** Rows per page for `findAll`. Fixed, not client-controlled. */
const TRANSACTIONS_PAGE_SIZE = 10;

/**
 * The category columns `toDto` reads off an included relation.
 *
 * Declared structurally rather than imported from Prisma because the same shape
 * is assembled by hand in `CategoriesService` — adding a column to `Category`
 * means touching both copies.
 */
interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: Date;
}

/** A transaction row as Prisma returns it with `include: { category: true }`. */
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

/**
 * Read and write access to the current user's transactions.
 *
 * Every method takes `userId` as its first argument and scopes its query by it:
 * there is no unscoped read here, and a row belonging to another user is
 * reported as missing rather than forbidden.
 */
@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns one page of the user's transactions, newest first.
   *
   * Filters are ANDed and applied in SQL, so `totalItems` counts the filtered
   * set rather than the whole table. Ordering is `date desc, id desc` — the id
   * breaks ties so rows sharing a timestamp cannot swap places between pages.
   *
   * @param userId - Owner of the rows.
   * @param query - Validated filters and 1-based page number; page defaults to 1.
   * @returns A page of transactions plus pagination metadata. `totalPages` is
   * `Math.ceil(totalItems / pageSize)`, so it is 0 when nothing matched, and a
   * page past the end yields an empty `items` rather than an error.
   */
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

  /**
   * Aggregates income, expense and balance for one calendar month.
   *
   * Postgres does the summing as Decimal; the balance is then computed in
   * integer cents so the subtraction never passes through a binary float.
   *
   * @param userId - Owner of the rows.
   * @param month - Calendar month, 1-12, as validated by `TransactionSummaryQueryDto`.
   * @param year - Four-digit year.
   * @returns Income, expense and balance as 2-decimal strings, echoing back the
   * requested month and year. A side with no rows reports `"0.00"` rather than
   * being absent, and `balance` may be negative.
   */
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

  /**
   * Fetches a single transaction with its category.
   *
   * @param userId - Owner of the row.
   * @param id - Transaction id, already parsed as a UUID by the controller.
   * @returns The transaction in API shape, category included.
   * @throws {NotFoundException} 404 — no transaction with that id belongs to
   * this user. Another user's row is reported as missing on purpose, so the
   * response cannot be used to probe which ids exist.
   */
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

  /**
   * Creates a transaction owned by the user.
   *
   * @param userId - Owner the row is created for; taken from the JWT, never the body.
   * @param dto - Validated payload. `amount` is always positive — the sign is
   * carried by `type` — and is converted to an exact decimal string before it
   * reaches Prisma.
   * @returns The created transaction, category included.
   * @throws {BadRequestException} 400 — `dto.categoryId` does not name a
   * category owned by this user.
   */
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

  /**
   * Applies a partial update; an omitted field keeps its stored value.
   *
   * Both ownership checks run before anything is written, so a foreign
   * transaction id or category id fails without mutating a row.
   *
   * @param userId - Owner of the row.
   * @param id - Transaction id.
   * @param dto - Any subset of the create payload. Note that `description` is
   * the only nullable column: sending `null` clears it, while omitting the key
   * leaves it alone.
   * @returns The updated transaction, category included.
   * @throws {NotFoundException} 404 — no transaction with that id belongs to this user.
   * @throws {BadRequestException} 400 — `dto.categoryId` was supplied but does
   * not name a category owned by this user.
   */
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

  /**
   * Deletes the user's transaction.
   *
   * Uses a scoped `deleteMany` and checks `count === 0` instead of `delete`
   * plus an ownership lookup, so existence and ownership are settled by one
   * statement that cannot reach another user's row.
   *
   * @param userId - Owner of the row.
   * @param id - Transaction id.
   * @returns Nothing — the controller answers 204 No Content.
   * @throws {NotFoundException} 404 — no transaction with that id belongs to this user.
   */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.transaction.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException("Transaction not found");
    }
  }

  /**
   * Verifies that a category id, when present, belongs to the user.
   *
   * Without this, a user could attach their transaction to someone else's
   * category id and read that category's name back out.
   *
   * @param userId - Owner the category must belong to.
   * @param categoryId - Category id to check. `undefined` is a no-op, which is
   * what makes this safe to call from `update`, where the field is optional.
   * @returns Nothing; it either returns or throws.
   * @throws {BadRequestException} 400 — the id names no category owned by this
   * user. Deliberately 400 rather than 404: the failure describes the submitted
   * body, and 404 would imply the transaction route itself was wrong.
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

  /**
   * Maps a Prisma row to the shape the API returns.
   *
   * @param transaction - Row fetched with its category included.
   * @returns The DTO, with `Decimal` rendered as a fixed 2-decimal string and
   * every `Date` as an ISO-8601 string.
   */
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
