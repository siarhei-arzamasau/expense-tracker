import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: "Groceries" })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: "#22c55e" })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
