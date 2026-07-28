import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * The OpenAPI shapes of this module's responses, which Swagger cannot infer.
 *
 * Every route here returns a plain interface from `@expense-tracker/shared` —
 * `TransactionDto`, `TransactionSummaryDto`, or `PaginatedResponse` generic
 * over the first — and `@nestjs/swagger` reflects over classes only, so there
 * is no decorated model for `getSchemaPath()` to point at. Declared once here
 * rather than inline so five endpoints document a transaction instead of
 * `object`. Request bodies need none of this: `CreateTransactionDto` and
 * `UpdateTransactionDto` are classes and document themselves.
 *
 * `amount` is a string on purpose — see `TransactionDto`. Postgres stores
 * Decimal(12, 2) and Prisma serializes it as a string to avoid float drift.
 * Every money field on the summary is a string for the same reason.
 *
 * These constants are hand-written and therefore able to drift: adding a field
 * to `TransactionDto` does not fail the build here, it just quietly leaves the
 * field out of the published docs.
 */

/** The embedded category, as `TransactionsService.toDto` assembles it. */
const CATEGORY_SCHEMA: SchemaObject = {
  type: "object",
  required: ["id", "name", "color", "icon", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "Groceries" },
    color: { type: "string", nullable: true, example: "#22c55e" },
    icon: { type: "string", nullable: true, example: "🛒" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** The OpenAPI shape of one `TransactionDto`; pass to `paginatedSchema()` for the list response. */
export const TRANSACTION_SCHEMA: SchemaObject = {
  type: "object",
  required: ["id", "amount", "type", "description", "date", "categoryId", "category", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    amount: { type: "string", example: "42.50", description: "Decimal(12, 2) as a string" },
    type: { type: "string", enum: ["INCOME", "EXPENSE"] },
    description: { type: "string", nullable: true, example: "Weekly shop" },
    date: { type: "string", format: "date-time" },
    categoryId: { type: "string", format: "uuid" },
    category: CATEGORY_SCHEMA,
    createdAt: { type: "string", format: "date-time" },
  },
};

/** The OpenAPI shape of `TransactionSummaryDto` — one calendar month's totals. */
export const TRANSACTION_SUMMARY_SCHEMA: SchemaObject = {
  type: "object",
  required: ["month", "year", "income", "expense", "balance"],
  properties: {
    month: { type: "integer", minimum: 1, maximum: 12, example: 7 },
    year: { type: "integer", example: 2026 },
    income: { type: "string", example: "3200.00", description: "Sum of INCOME rows" },
    expense: { type: "string", example: "1847.60", description: "Sum of EXPENSE rows, unsigned" },
    balance: {
      type: "string",
      example: "1352.40",
      description: "income - expense; may be negative",
    },
  },
};
