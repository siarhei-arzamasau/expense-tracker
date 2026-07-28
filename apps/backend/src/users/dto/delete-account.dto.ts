import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

/**
 * Request body for `DELETE /api/users/me`.
 *
 * Account deletion is irreversible and cascades to the user's categories and
 * transactions, so possession of a valid bearer token is not sufficient: the
 * current password must be supplied and verified as well.
 */
export class DeleteAccountDto {
  /** Current account password used to authorize the deletion. */
  @ApiProperty({
    example: "password123",
    description: "Current account password",
    minLength: 1,
    format: "password",
  })
  @IsString()
  @MinLength(1)
  password!: string;
}
