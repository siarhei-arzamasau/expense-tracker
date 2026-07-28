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
 * Query string for `GET /api/transactions`. Every filter is optional, and
 * several combined are ANDed.
 *
 * `main.ts` sets `forbidNonWhitelisted: true`, so query filters must arrive
 * through a decorated class or an unknown param 400s. Implementing
 * `TransactionQuery` is what keeps the frontend honest: drop a filter on either
 * side and `tsc` fails on the other.
 */
export class FindTransactionsQueryDto implements TransactionQuery {
  /** 1-based page number. Absent means page 1; page size is fixed server-side at 10. */
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: MAX_PAGE, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;

  /** Case-insensitive substring match on the description. Does not search category names. */
  @ApiPropertyOptional({ example: "groceries", maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  /** Inclusive lower bound on `date` (`gte`). */
  @ApiPropertyOptional({ example: "2026-07-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /**
   * Inclusive upper bound on `date` (`lte`). Being inclusive, a bare
   * `2026-07-31` means midnight — pass an end-of-day time to cover that day.
   */
  @ApiPropertyOptional({ example: "2026-07-31T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Restricts to income or expense. */
  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  /** Restricts to one category. An id the user does not own simply matches nothing. */
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
