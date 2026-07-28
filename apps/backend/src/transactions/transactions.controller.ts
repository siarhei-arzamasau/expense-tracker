import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type {
  PaginatedResponse,
  TransactionDto,
  TransactionSummaryDto,
} from "@expense-tracker/shared";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { errorSchema } from "../common/swagger/error-schema";
import { paginatedSchema } from "../common/swagger/paginated-schema";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { FindTransactionsQueryDto } from "./dto/find-transactions-query.dto";
import { TransactionSummaryQueryDto } from "./dto/transaction-summary-query.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { TRANSACTION_SCHEMA, TRANSACTION_SUMMARY_SCHEMA } from "./transaction.schema";
import { TransactionsService } from "./transactions.service";

/**
 * Documents the id path parameter shared by the three `:id` routes.
 *
 * Swagger picks the parameter up from the route path on its own, but as an
 * untyped string; this is what puts `format: uuid` and the `ParseUUIDPipe`
 * rejection in the published docs.
 */
const ID_PARAM = {
  name: "id",
  format: "uuid",
  description: "Transaction id. Anything that is not a UUID is rejected with 400.",
} as const;

/**
 * HTTP surface for `/api/transactions`.
 *
 * `JwtAuthGuard` covers the whole class, so every route below answers **401**
 * to a missing, malformed or expired bearer token before its handler runs, and
 * `@CurrentUser()` is guaranteed to hold a real user inside one. The user id
 * always comes from the token — no route reads an owner from the body or the
 * query string.
 *
 * Handlers delegate to `TransactionsService` and return its promise unchanged;
 * the exceptions listed on each one are raised there and mapped to status codes
 * by Nest's exception filter.
 *
 * The 401 is declared once on the class rather than six times on the methods —
 * `@ApiUnauthorizedResponse` applies to every route below, the same way
 * `@ApiBearerAuth` does, because the guard it describes is registered here too.
 */
@ApiTags("transactions")
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: "Missing, malformed or expired bearer token",
  schema: errorSchema(HttpStatus.UNAUTHORIZED, "Unauthorized"),
})
@UseGuards(JwtAuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * `POST /api/transactions` — records a new transaction for the current user.
   *
   * @param user - Authenticated user, from the JWT.
   * @param dto - Request body, validated by the global `ValidationPipe`.
   * @returns 201 with the created transaction.
   * @throws {BadRequestException} 400 — the body fails validation, carries an
   * unknown property (`forbidNonWhitelisted`), or names a category the user
   * does not own.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   */
  @Post()
  @ApiOperation({
    summary: "Create a transaction",
    description:
      "The owner is taken from the bearer token; the body has no user field. `categoryId` must name a category the same user owns.",
  })
  @ApiCreatedResponse({
    description: "The created transaction, category included",
    schema: TRANSACTION_SCHEMA,
  })
  @ApiBadRequestResponse({
    description:
      "The body failed validation, carried an unknown property, or named a category the user does not own",
    schema: errorSchema(HttpStatus.BAD_REQUEST, [
      "amount must be a positive number",
      "categoryId must be a UUID",
    ]),
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactionsService.create(user.id, dto);
  }

  /**
   * `GET /api/transactions` — one page of the user's transactions, newest first.
   *
   * @param user - Authenticated user, from the JWT.
   * @param query - Optional filters (`search`, `type`, `categoryId`, `dateFrom`,
   * `dateTo`) and a 1-based `page`. Page size is fixed by the server.
   * @returns 200 with a `PaginatedResponse<TransactionDto>`. An out-of-range
   * page is an empty `items`, not an error.
   * @throws {BadRequestException} 400 — an unknown query parameter, or one that
   * fails validation (`page` above the 10,000 cap, a malformed date, a
   * `categoryId` that is not a UUID).
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   */
  @Get()
  @ApiOperation({
    summary: "List the current user's paginated transactions, newest first",
    description:
      "Filters are ANDed and applied in SQL, so `totalItems` counts the filtered set. Page size is fixed server-side at 10; `totalPages` is 0 when nothing matched, and a page past the end returns an empty `items` rather than an error.",
  })
  @ApiOkResponse({
    description: "A page of transactions with pagination metadata",
    schema: paginatedSchema(TRANSACTION_SCHEMA),
  })
  @ApiBadRequestResponse({
    description: "An unknown query parameter, or one that failed validation",
    schema: errorSchema(HttpStatus.BAD_REQUEST, ["page must not be greater than 10000"]),
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindTransactionsQueryDto,
  ): Promise<PaginatedResponse<TransactionDto>> {
    return this.transactionsService.findAll(user.id, query);
  }

  /**
   * `GET /api/transactions/summary` — income, expense and balance for one month.
   *
   * Must be declared before `@Get(":id")` — Nest matches routes in declaration
   * order, and reversed, the literal string "summary" goes into ParseUUIDPipe
   * and 400s instead of resolving here.
   *
   * @param user - Authenticated user, from the JWT.
   * @param query - Required `month` (1-12) and `year` (1970-2100).
   * @returns 200 with the month's totals as 2-decimal strings; a month with no
   * rows reports `"0.00"` rather than 404.
   * @throws {BadRequestException} 400 — `month` or `year` missing, non-numeric,
   * or out of range.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   */
  @Get("summary")
  @ApiOperation({
    summary: "Aggregate income/expense/balance for a given month",
    description:
      'Sums the user\'s transactions over one calendar month in UTC. A month with no rows reports `"0.00"` on every side rather than 404.',
  })
  @ApiOkResponse({
    description: "The month's totals, as 2-decimal strings",
    schema: TRANSACTION_SUMMARY_SCHEMA,
  })
  @ApiBadRequestResponse({
    description: "`month` or `year` is missing, non-numeric, or out of range",
    schema: errorSchema(HttpStatus.BAD_REQUEST, ["month must not be greater than 12"]),
  })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummaryDto> {
    return this.transactionsService.summary(user.id, query.month, query.year);
  }

  /**
   * `GET /api/transactions/:id` — a single transaction with its category.
   *
   * @param user - Authenticated user, from the JWT.
   * @param id - Transaction id; `ParseUUIDPipe` rejects anything that is not a UUID.
   * @returns 200 with the transaction.
   * @throws {BadRequestException} 400 — `id` is not a UUID.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {NotFoundException} 404 — no such transaction for this user; another
   * user's id is reported the same way.
   */
  @Get(":id")
  @ApiOperation({
    summary: "Fetch a single transaction",
    description:
      "Scoped to the caller: another user's transaction is reported as missing, so the response cannot be used to probe which ids exist.",
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: "The transaction, category included", schema: TRANSACTION_SCHEMA })
  @ApiBadRequestResponse({
    description: "`id` is not a UUID",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Validation failed (uuid is expected)"),
  })
  @ApiNotFoundResponse({
    description: "No transaction with that id belongs to this user",
    schema: errorSchema(HttpStatus.NOT_FOUND, "Transaction not found"),
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TransactionDto> {
    return this.transactionsService.findOne(user.id, id);
  }

  /**
   * `PATCH /api/transactions/:id` — updates the fields present in the body.
   *
   * @param user - Authenticated user, from the JWT.
   * @param id - Transaction id; `ParseUUIDPipe` rejects anything that is not a UUID.
   * @param dto - Any subset of the create payload; omitted fields are left alone.
   * @returns 200 with the updated transaction.
   * @throws {BadRequestException} 400 — `id` is not a UUID, the body fails
   * validation or carries an unknown property, or `categoryId` names a category
   * the user does not own.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {NotFoundException} 404 — no such transaction for this user.
   */
  @Patch(":id")
  @ApiOperation({
    summary: "Update a transaction",
    description:
      "Any subset of the create payload. An omitted field keeps its stored value; `description` is the only nullable column, so sending `null` there clears it.",
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: "The updated transaction", schema: TRANSACTION_SCHEMA })
  @ApiBadRequestResponse({
    description:
      "`id` is not a UUID, the body failed validation or carried an unknown property, or `categoryId` names a category the user does not own",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Unknown category"),
  })
  @ApiNotFoundResponse({
    description: "No transaction with that id belongs to this user",
    schema: errorSchema(HttpStatus.NOT_FOUND, "Transaction not found"),
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactionsService.update(user.id, id, dto);
  }

  /**
   * `DELETE /api/transactions/:id` — permanently deletes the transaction.
   *
   * @param user - Authenticated user, from the JWT.
   * @param id - Transaction id; `ParseUUIDPipe` rejects anything that is not a UUID.
   * @returns 204 No Content, with an empty body. Not idempotent in its status
   * code: deleting the same id twice answers 404 the second time.
   * @throws {BadRequestException} 400 — `id` is not a UUID.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {NotFoundException} 404 — no such transaction for this user.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a transaction",
    description:
      "Permanent. Not idempotent in its status code: deleting the same id twice answers 404 the second time.",
  })
  @ApiParam(ID_PARAM)
  @ApiNoContentResponse({ description: "The transaction was deleted; the body is empty" })
  @ApiBadRequestResponse({
    description: "`id` is not a UUID",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Validation failed (uuid is expected)"),
  })
  @ApiNotFoundResponse({
    description: "No transaction with that id belongs to this user",
    schema: errorSchema(HttpStatus.NOT_FOUND, "Transaction not found"),
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.transactionsService.remove(user.id, id);
  }
}
