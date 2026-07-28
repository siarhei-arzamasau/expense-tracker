import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Request body for `PATCH /api/users/me/password`.
 *
 * Both values are required strings. The current password only needs to be
 * non-empty because it is checked against the stored hash; the replacement
 * uses the same 8-72 character bounds as registration.
 */
export class ChangePasswordDto {
  /** Current account password used to authorize the change. */
  @ApiProperty({
    example: "password123",
    description: "Current account password",
    minLength: 1,
    format: "password",
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  /**
   * Replacement password. The bounds match `RegisterDto`, so every password
   * accepted at registration can also be set through this endpoint.
   */
  @ApiProperty({
    example: "new-password-456",
    description: "New account password",
    minLength: 8,
    maxLength: 72,
    format: "password",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  newPassword!: string;
}
