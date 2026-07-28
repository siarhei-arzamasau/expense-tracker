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

  @ApiProperty({ enum: TRANSACTION_TYPES, example: "EXPENSE" })
  @IsIn(TRANSACTION_TYPES)
  type!: TransactionType;

  @ApiPropertyOptional({ example: "Weekly shop" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: "2026-07-28T12:00:00.000Z" })
  @IsDateString()
  date!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  categoryId!: string;
}
