import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

/**
 * Both required per the prompt. `main.ts`'s `transformOptions.enableImplicitConversion`
 * handles the string -> number coercion from query params.
 */
export class TransactionSummaryQueryDto {
  @ApiProperty({ example: 7, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 2026, minimum: 1970, maximum: 2100 })
  @IsInt()
  @Min(1970)
  @Max(2100)
  year!: number;
}
