import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class DeleteAccountDto {
  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(1)
  password!: string;
}
