import type { CategoryDto } from "./category";

/**
 * An expense as the API returns it.
 *
 * `amount` is a STRING, not a number. Postgres stores it as `Decimal(12, 2)`
 * and Prisma serializes Decimal to a string over JSON to avoid the float
 * rounding errors you get from IEEE-754 doubles. Parse it at the display
 * boundary; doing arithmetic on it directly gives you `NaN` or, worse,
 * silently wrong money.
 */
export interface ExpenseDto {
  id: string;
  amount: string;
  description: string | null;
  spentAt: string;
  categoryId: string | null;
  category: CategoryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseInput {
  amount: number;
  description?: string;
  spentAt: string;
  categoryId?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;
