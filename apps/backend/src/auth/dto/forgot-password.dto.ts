import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

/**
 * Request body for `POST /api/auth/forgot-password`.
 *
 * Only syntax is validated here. The endpoint intentionally gives the same
 * 204 response whether or not the submitted address belongs to an account.
 */
export class ForgotPasswordDto {
  /** Email for which to issue a reset link when an account exists. */
  @ApiProperty({ example: "demo@example.com", format: "email" })
  @IsEmail()
  email!: string;
}
