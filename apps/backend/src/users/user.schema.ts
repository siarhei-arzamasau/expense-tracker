import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * The OpenAPI shape of `UserDto`, which Swagger cannot infer from the shared
 * interface at runtime.
 *
 * Kept beside the users module but exported for `AuthController`, whose login,
 * registration and profile responses embed the same public user shape. This
 * schema is hand-written and can therefore drift: when `UserDto` changes, this
 * constant must change with it.
 */
export const USER_SCHEMA: SchemaObject = {
  type: "object",
  required: ["id", "email", "name", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email", example: "demo@example.com" },
    name: { type: "string", nullable: true, example: "Demo User" },
    createdAt: { type: "string", format: "date-time" },
  },
};
