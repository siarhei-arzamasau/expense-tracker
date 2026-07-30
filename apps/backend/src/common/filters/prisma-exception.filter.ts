import {
  BadRequestException,
  Catch,
  ConflictException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
  type HttpException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
// Value import: @Catch() needs the class itself at runtime to match a thrown
// error against this filter.
import { Prisma } from "@expense-tracker/database";

/**
 * Turns the three Prisma constraint failures a request can provoke into the
 * status codes the endpoints already document.
 *
 * Every check-then-write path in this codebase looks up a row, decides the write
 * is legal, and then writes — `CategoriesService.create`, `UsersService.create`,
 * `UsersService.updateProfile`, `TransactionsService.create`. That gap is small
 * but real: when a concurrent request wins it, Postgres rejects the write and
 * Prisma raises a `PrismaClientKnownRequestError`, which is not an
 * `HttpException`, so Nest's default filter answered a bare **500** for a case
 * the JSDoc and the Swagger response decorator both promise as 409 or 400.
 * Re-checking in a transaction would fix the race itself; translating the error
 * fixes the status, which is what the client acts on.
 *
 * Registered through `APP_FILTER` in `app.module.ts` rather than
 * `useGlobalFilters` in `main.ts`, deliberately: a filter that has to be
 * installed by each bootstrap separately is missing from the e2e harness the day
 * someone adds a second one. Being a module provider, it also gets the
 * `HttpAdapterHost` that `BaseExceptionFilter` needs by injection.
 *
 * Delegating to `super.catch` with a translated exception, rather than writing a
 * body here, is what keeps the response identical to every other error the API
 * returns — the shape `errorSchema()` documents.
 *
 * A code this filter does not know stays a 500, unchanged: guessing a 4xx for an
 * unrecognised database failure would report a server fault as the caller's
 * mistake.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  /**
   * Answers a known constraint failure with its HTTP equivalent.
   *
   * @param exception - The error Prisma raised for a rejected statement.
   * @param host - Nest's arguments host for the failed request.
   */
  override catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const translated = this.translate(exception);

    if (!translated) {
      super.catch(exception, host);
      return;
    }

    // `meta` names the constraint or column that failed, which is what makes a
    // log line worth reading and is also why it does not go in the response.
    this.logger.warn(
      `Prisma ${exception.code} answered as ${String(translated.getStatus())}: ${JSON.stringify(exception.meta ?? {})}`,
    );

    super.catch(translated, host);
  }

  /**
   * Maps a Prisma error code to the exception the route documents.
   *
   * The messages are deliberately generic. A caller only reaches this filter by
   * losing a race — the ordinary path is the service's own pre-check, which
   * raises the same status with a specific message — so naming the column here
   * would describe the schema to whoever provoked it for no benefit.
   *
   * @param exception - The error Prisma raised.
   * @returns The exception to answer with, or `null` to leave it a 500.
   */
  private translate(exception: Prisma.PrismaClientKnownRequestError): HttpException | null {
    switch (exception.code) {
      // Unique constraint violated: the row the pre-check did not see.
      case "P2002":
        return new ConflictException("A record with those values already exists");
      // Foreign key constraint violated, in both directions: a referenced row
      // that has gone, or a referencing row that still exists.
      case "P2003":
        return new BadRequestException("A referenced record does not exist");
      // An update or delete matched nothing.
      case "P2025":
        return new NotFoundException("Record not found");
      default:
        return null;
    }
  }
}
