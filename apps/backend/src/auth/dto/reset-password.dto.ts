import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, MaxLength, MinLength } from "class-validator";

/** Request body for `POST /api/auth/reset-password`. */
export class ResetPasswordDto {
  /**
   * Single-use credential from the reset URL. A base64url encoding of the 32
   * random source bytes is exactly 43 characters.
   */
  // base64url of 32 random bytes is always exactly 43 characters, so the
  // bound is known precisely — a garbage value this short never reaches the
  // database.
  @ApiProperty({ description: "Token from the reset link", minLength: 43, maxLength: 43 })
  @IsString()
  @Length(43, 43)
  token!: string;

  /** Replacement plaintext password; hashed before it is stored. */
  @ApiProperty({ example: "password123", minLength: 8, maxLength: 72, format: "password" })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  password!: string;
}
