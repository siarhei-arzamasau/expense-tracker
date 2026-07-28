import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  // base64url of 32 random bytes is always exactly 43 characters, so the
  // bound is known precisely — a garbage value this short never reaches the
  // database.
  @ApiProperty({ description: "Token from the reset link" })
  @IsString()
  @Length(43, 43)
  token!: string;

  @ApiProperty({ example: "password123", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  password!: string;
}
