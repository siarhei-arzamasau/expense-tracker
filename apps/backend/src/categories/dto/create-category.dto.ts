import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { IsSingleEmoji } from "../validators/is-single-emoji";

/**
 * Request body for `POST /api/categories`.
 *
 * Validation rules live on this backend class while
 * `@expense-tracker/shared` exposes request shapes only. The global
 * `ValidationPipe` rejects invalid or unknown fields with 400 before the
 * controller runs. `color` and `icon` admit `null` so the derived update DTO
 * can use `null` to clear either nullable database column.
 */
export class CreateCategoryDto {
  /** User-visible name, unique per user. */
  @ApiProperty({ example: "Groceries", minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  /** Optional CSS hexadecimal colour; `null` means no colour. */
  @ApiPropertyOptional({ example: "#22c55e", nullable: true })
  @IsOptional()
  @IsHexColor()
  color?: string | null;

  /** Optional single emoji grapheme; `null` means no icon. */
  @ApiPropertyOptional({ example: "🛒", nullable: true })
  @IsOptional()
  @IsSingleEmoji()
  icon?: string | null;
}
