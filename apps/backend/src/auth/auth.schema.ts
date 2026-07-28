import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

import { USER_SCHEMA } from "../users/user.schema";

/**
 * OpenAPI shape of `AuthResponse`, returned by registration and login.
 *
 * `AuthResponse` and its nested `UserDto` are interfaces from the shared
 * package, and Swagger can reflect only runtime classes. This hand-written
 * schema therefore composes the users module's canonical response schema
 * rather than duplicating its fields here. Keep it synchronized if the shared
 * response shape changes.
 */
export const AUTH_RESPONSE_SCHEMA: SchemaObject = {
  type: "object",
  required: ["accessToken", "user"],
  properties: {
    accessToken: {
      type: "string",
      description: "Signed JWT to send as a bearer token",
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    },
    user: USER_SCHEMA,
  },
};
