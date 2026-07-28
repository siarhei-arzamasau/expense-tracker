import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  // Same bounds as RegisterDto, so a password that can be set at registration
  // is also one that can be changed to.
  @ApiProperty({ example: "new-password-456", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(72, { message: "Password must be at most 72 characters" })
  newPassword!: string;
}
