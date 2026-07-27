import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from "class-validator";

export class CreateExpenseDto {
  /**
   * Accepted as a number for ergonomics, then stored as Decimal(12, 2).
   * `maxDecimalPlaces: 2` rejects 10.005 rather than silently rounding it.
   */
  @ApiProperty({ example: 42.5, description: "Positive amount, max 2 decimal places" })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9_999_999_999)
  amount!: number;

  @ApiPropertyOptional({ example: "Weekly shop" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: "2026-07-28T12:00:00.000Z" })
  @IsDateString()
  spentAt!: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
