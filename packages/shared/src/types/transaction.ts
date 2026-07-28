import type { CategoryDto } from "./category";

/** Mirrors the Prisma `TransactionType` enum — kept here because packages/shared must not import @expense-tracker/database. */
export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * A transaction as the API returns it.
 *
 * `amount` is a STRING, not a number. Postgres stores it as `Decimal(12, 2)`
 * and Prisma serializes Decimal to a string over JSON to avoid the float
 * rounding errors you get from IEEE-754 doubles. Parse it at the display
 * boundary; doing arithmetic on it directly gives you `NaN` or, worse,
 * silently wrong money.
 */
export interface TransactionDto {
  id: string;
  amount: string;
  type: TransactionType;
  description: string | null;
  date: string;
  categoryId: string;
  category: CategoryDto;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TransactionQuery {
  page?: number;
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionSummaryDto {
  month: number;
  year: number;
  income: string;
  expense: string;
  /** income - expense, as a 2-decimal string. May be negative. */
  balance: string;
}

export interface CreateTransactionInput {
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  categoryId: string;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;
