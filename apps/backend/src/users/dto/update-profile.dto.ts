import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Request body for `PATCH /api/users/me`.
 *
 * Both fields are optional individually, but `UsersService` rejects a body in
 * which neither is present. Validation is otherwise handled by the global
 * `ValidationPipe` before the controller runs.
 */
export class UpdateProfileDto {
  /** Replacement email address. Omission leaves the stored email unchanged. */
  @ApiPropertyOptional({
    example: "new@example.com",
    description: "New email address; omit to leave it unchanged",
    format: "email",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * Nullable so the name can be cleared: @IsOptional() skips validation for
   * both undefined and null, and UsersService tells them apart — undefined
   * leaves the name alone, null wipes it.
   */
  @ApiPropertyOptional({
    example: "Demo User",
    description: "Display name; omit to leave unchanged or send null to clear it",
    nullable: true,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;
}
