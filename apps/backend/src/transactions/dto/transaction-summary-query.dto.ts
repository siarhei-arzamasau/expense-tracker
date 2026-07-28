import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

/**
 * Query string for `GET /api/transactions/summary`.
 *
 * Both required per the prompt. `main.ts`'s `transformOptions.enableImplicitConversion`
 * handles the string -> number coercion from query params.
 */
export class TransactionSummaryQueryDto {
  /** Calendar month, 1-12. Not zero-based — 7 is July, unlike the `Date` constructor. */
  @ApiProperty({ example: 7, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  /** Four-digit year. The bounds are a sanity check, not a product rule. */
  @ApiProperty({ example: 2026, minimum: 1970, maximum: 2100 })
  @IsInt()
  @Min(1970)
  @Max(2100)
  year!: number;
}
