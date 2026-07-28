import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * OpenAPI response shapes for category routes.
 *
 * The API returns plain interfaces from `@expense-tracker/shared`, but Swagger
 * reflects over classes only. These hand-written schemas therefore document
 * the response bodies while the decorated request DTO classes document request
 * bodies. Keep them synchronized when a shared category interface changes.
 */

/** The OpenAPI shape of one `CategoryDto`. */
export const CATEGORY_SCHEMA: SchemaObject = {
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

/** The OpenAPI shape of a `CategoryListItemDto`, including its usage count. */
export const CATEGORY_LIST_ITEM_SCHEMA: SchemaObject = {
  ...CATEGORY_SCHEMA,
  required: [...(CATEGORY_SCHEMA.required ?? []), "transactionCount"],
  properties: {
    ...CATEGORY_SCHEMA.properties,
    transactionCount: { type: "integer", minimum: 0, example: 12 },
  },
};
