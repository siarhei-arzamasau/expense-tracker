import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "new@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * Nullable so the name can be cleared: @IsOptional() skips validation for
   * both undefined and null, and UsersService tells them apart — undefined
   * leaves the name alone, null wipes it.
   */
  @ApiPropertyOptional({ example: "Demo User", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;
}
