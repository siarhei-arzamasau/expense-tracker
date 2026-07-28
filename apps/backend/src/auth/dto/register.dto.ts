import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Request body for `POST /api/auth/register`.
 *
 * Validation lives on this runtime class while `RegisterInput` in the shared
 * package carries only the transport shape. The application's password policy
 * accepts 8-72 characters.
 */
export class RegisterDto {
  /** Unique email used for login. */
  @ApiProperty({ example: "demo@example.com", format: "email" })
  @IsEmail()
  email!: string;

  /** Plaintext password; hashed behind the users command boundary before storage. */
  @ApiProperty({ example: "password123", minLength: 8, maxLength: 72, format: "password" })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  password!: string;

  /** Optional display name. Omission is stored and returned as `null`. */
  @ApiPropertyOptional({ example: "Demo User", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
