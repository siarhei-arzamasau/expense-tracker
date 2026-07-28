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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  PaginatedResponse,
  TransactionDto,
  TransactionSummaryDto,
} from "@expense-tracker/shared";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { paginatedSchema } from "../common/swagger/paginated-schema";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { FindTransactionsQueryDto } from "./dto/find-transactions-query.dto";
import { TransactionSummaryQueryDto } from "./dto/transaction-summary-query.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { TRANSACTION_SCHEMA } from "./transaction.schema";
import { TransactionsService } from "./transactions.service";

@ApiTags("transactions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: "Create a transaction" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactionsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's paginated transactions, newest first" })
  @ApiOkResponse({
    description: "A page of transactions with pagination metadata",
    schema: paginatedSchema(TRANSACTION_SCHEMA),
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindTransactionsQueryDto,
  ): Promise<PaginatedResponse<TransactionDto>> {
    return this.transactionsService.findAll(user.id, query);
  }

  // Must be declared before @Get(":id") — Nest matches routes in declaration
  // order, and reversed, the literal string "summary" goes into ParseUUIDPipe
  // and 400s instead of resolving here.
  @Get("summary")
  @ApiOperation({ summary: "Aggregate income/expense/balance for a given month" })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TransactionSummaryQueryDto,
  ): Promise<TransactionSummaryDto> {
    return this.transactionsService.summary(user.id, query.month, query.year);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch a single transaction" })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TransactionDto> {
    return this.transactionsService.findOne(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a transaction" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a transaction" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.transactionsService.remove(user.id, id);
  }
}
