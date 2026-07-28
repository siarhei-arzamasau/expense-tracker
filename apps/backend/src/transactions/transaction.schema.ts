import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * The OpenAPI shape of `TransactionDto`, for responses Swagger cannot infer.
 *
 * Most endpoints here return a decorated class and need none of this. The
 * paginated list does: its return type is `PaginatedResponse<TransactionDto>`,
 * a generic over two plain interfaces from `@expense-tracker/shared`, and
 * `@nestjs/swagger` reflects over classes only. Declared once here rather than
 * inline so the list endpoint documents a transaction instead of `object`.
 *
 * `amount` is a string on purpose — see `TransactionDto`. Postgres stores
 * Decimal(12, 2) and Prisma serializes it as a string to avoid float drift.
 */
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
