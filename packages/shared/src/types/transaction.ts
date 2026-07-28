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

/**
 * Query parameters for `GET /api/transactions`.
 *
 * `FindTransactionsQueryDto implements TransactionQuery`, so the backend cannot
 * drop a filter the frontend still sends without `tsc` saying so. The rules
 * themselves (`@Min`, `@MaxLength`, …) stay on the DTO — this is the shape
 * only.
 */
export interface TransactionQuery {
  page?: number;
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Response of `GET /api/transactions/summary`: one calendar month's totals.
 *
 * Every money field is a 2-decimal string for the same reason `TransactionDto.amount`
 * is. A month with no transactions is `"0.00"` across the board, never absent.
 */
export interface TransactionSummaryDto {
  /** Echo of the requested month, 1-12. */
  month: number;
  /** Echo of the requested year. */
  year: number;
  /** Sum of INCOME rows, as a 2-decimal string. */
  income: string;
  /** Sum of EXPENSE rows, as a 2-decimal string and unsigned. */
  expense: string;
  /** income - expense, as a 2-decimal string. May be negative. */
  balance: string;
}

/**
 * Request body for `POST /api/transactions`.
 *
 * `amount` is a `number` here, unlike the `string` that comes back on
 * `TransactionDto` — the asymmetry is deliberate. Sending is ergonomic and the
 * backend converts with `.toFixed(2)` before Prisma sees it; receiving keeps
 * the exact decimal Postgres stored.
 *
 * The shape only. Bounds and formats are enforced by `CreateTransactionDto` on
 * the backend and are not mirrored here.
 */
export interface CreateTransactionInput {
  /** Positive, at most 2 decimal places. The sign lives in `type`. */
  amount: number;
  type: TransactionType;
  description?: string;
  /** ISO-8601 string. */
  date: string;
  /** Must name a category owned by the same user, or the request 400s. */
  categoryId: string;
}

/**
 * Request body for `PATCH /api/transactions/:id`. An omitted field is left
 * as it is; `description: null` clears it, and it is the only field that can be.
 */
export type UpdateTransactionInput = Partial<CreateTransactionInput>;
