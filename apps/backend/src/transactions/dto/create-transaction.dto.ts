import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TRANSACTION_TYPES, type TransactionType } from "@expense-tracker/shared";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from "class-validator";

/**
 * Request body for `POST /api/transactions`.
 *
 * This class is where the validation rules live — `packages/shared` describes
 * the same request as `CreateTransactionInput` but carries shapes only, and the
 * decorators below are deliberately not mirrored there. A violation of any of
 * them is a 400 raised by the global `ValidationPipe` before the controller
 * runs, so no service method ever sees an invalid field.
 */
export class CreateTransactionDto {
  /**
   * Accepted as a number for ergonomics, then stored as Decimal(12, 2).
   * `maxDecimalPlaces: 2` rejects 10.005 rather than silently rounding it.
   * Always positive — the sign is carried by `type`, never by the amount.
   */
  @ApiProperty({ example: 42.5, description: "Positive amount, max 2 decimal places" })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9_999_999_999)
  amount!: number;

  /** Direction of the money: this, not the amount's sign, is what makes it an expense. */
  @ApiProperty({ enum: TRANSACTION_TYPES, example: "EXPENSE" })
  @IsIn(TRANSACTION_TYPES)
  type!: TransactionType;

  /** Free text, optional. Omitted here becomes `null` in the column. */
  @ApiPropertyOptional({ example: "Weekly shop" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** When the transaction happened, as an ISO-8601 string. Any date is accepted, including future ones. */
  @ApiProperty({ example: "2026-07-28T12:00:00.000Z" })
  @IsDateString()
  date!: string;

  /**
   * Category to file this under. Being a UUID is checked here; belonging to the
   * requesting user is checked in the service, which 400s if it does not.
   */
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  categoryId!: string;
}
