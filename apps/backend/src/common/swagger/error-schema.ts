import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * The OpenAPI shape of an error body, as Nest's built-in exception filter
 * renders it.
 *
 * Every 4xx here is `HttpException`'s default body: `statusCode`, `message`, and
 * an `error` reason phrase. `error` is optional because `HttpException` omits it
 * when the message *is* the reason phrase, which is what
 * `new UnauthorizedException()` produces.
 *
 * `PrismaExceptionFilter` is the only filter of our own, and it does not change
 * this shape — it translates a Prisma constraint failure into the matching
 * `HttpException` and hands that to `BaseExceptionFilter`, precisely so that a
 * lost race renders the same body as a thrown 409 rather than a second dialect
 * of error. That is asserted over HTTP in its spec; keep it true.
 *
 * `message` is typed as either a string or an array of strings because both
 * really occur, sometimes on the same route: the `ValidationPipe` reports one
 * entry per failed constraint, while an exception thrown by a service carries a
 * single sentence. Callers pass whichever one their route is most likely to
 * return as the example.
 *
 * Hand-written, like `paginatedSchema()` next door, and for the same reason —
 * the response is a plain object built by the framework, not a decorated class
 * `@nestjs/swagger` could reflect over.
 *
 * @param statusCode - Status this body accompanies; used as the example.
 * @param message - Example message. An array documents the validation case, a
 * string the thrown-exception case; the schema itself admits both either way.
 * @returns A schema object for the `schema` option of `@ApiResponse` and its
 * per-status shorthands.
 */
export function errorSchema(statusCode: number, message: string | string[]): SchemaObject {
  return {
    type: "object",
    required: ["statusCode", "message"],
    properties: {
      statusCode: { type: "integer", example: statusCode },
      message: {
        oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        example: message,
        description:
          "One entry per failed constraint when the ValidationPipe rejects the request, a single string otherwise.",
      },
      error: {
        type: "string",
        description: "Reason phrase; absent when it would repeat `message`.",
      },
    },
  };
}
