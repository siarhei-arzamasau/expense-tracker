import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

/** Request body for `POST /api/auth/login`. */
export class LoginDto {
  /** Registered account email. Unknown addresses share the same 401 as a wrong password. */
  @ApiProperty({ example: "demo@example.com", format: "email" })
  @IsEmail()
  email!: string;

  /** Plaintext password used only for credential verification. */
  @ApiProperty({ example: "password123", minLength: 1, format: "password" })
  @IsString()
  @MinLength(1)
  password!: string;
}
