import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  TRANSACTION_TYPES,
  type TransactionQuery,
  type TransactionType,
} from "@expense-tracker/shared";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * An upper bound on `page` is a cost control, not a product rule. `skip` is a
 * SQL `OFFSET`, which Postgres answers by walking and discarding every row
 * before it — so an unbounded `?page=` lets one cheap request buy an
 * arbitrarily expensive scan on an API that has no rate limiting. At ten rows
 * a page this still reaches 100k transactions.
 */
const MAX_PAGE = 10_000;

/**
 * `main.ts` sets `forbidNonWhitelisted: true`, so query filters must arrive
 * through a decorated class or an unknown param 400s.
 */
export class FindTransactionsQueryDto implements TransactionQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: MAX_PAGE, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;

  @ApiPropertyOptional({ example: "groceries", maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ example: "2026-07-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-07-31T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
