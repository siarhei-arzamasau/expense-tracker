import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * The OpenAPI shape of `PaginatedResponse<T>` from `@expense-tracker/shared`.
 *
 * Written by hand rather than derived, because `PaginatedResponse` is an
 * interface and `@nestjs/swagger` can only reflect over classes — there is no
 * decorated model for `getSchemaPath()` to point at. Keeping it in one function
 * is what stops the envelope from being copy-pasted into every list endpoint
 * and drifting field by field; only the item schema varies.
 *
 * @param items - Schema of a single element, e.g. `TRANSACTION_SCHEMA`.
 * @returns A schema object for `@ApiOkResponse({ schema })`. Being hand-written
 * it cannot drift into a compile error, so a field added to the envelope has to
 * be added here by hand as well.
 */
export function paginatedSchema(items: SchemaObject): SchemaObject {
  return {
    type: "object",
    required: ["items", "page", "pageSize", "totalItems", "totalPages"],
    properties: {
      items: { type: "array", items },
      page: { type: "integer", example: 1 },
      pageSize: { type: "integer", example: 10 },
      totalItems: { type: "integer", example: 23 },
      /** `Math.ceil(totalItems / pageSize)` — 0 when there are no rows at all. */
      totalPages: { type: "integer", example: 3 },
    },
  };
}
