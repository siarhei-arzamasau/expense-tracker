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
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ExpenseDto } from "@expense-tracker/shared";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

@ApiTags("expenses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's expenses, newest first" })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<ExpenseDto[]> {
    return this.expensesService.findAll(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch a single expense" })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ExpenseDto> {
    return this.expensesService.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: "Create an expense" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expensesService.create(user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an expense" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseDto> {
    return this.expensesService.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an expense" })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.expensesService.remove(user.id, id);
  }
}
