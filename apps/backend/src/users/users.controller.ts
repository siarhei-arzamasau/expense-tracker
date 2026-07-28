import { Body, Controller, Delete, HttpCode, HttpStatus, Patch, UseGuards } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { UserDto } from "@expense-tracker/shared";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { errorSchema } from "../common/swagger/error-schema";
import { ChangeUserPasswordCommand } from "./commands/change-user-password.command";
import { DeleteUserCommand } from "./commands/delete-user.command";
import { UpdateUserProfileCommand } from "./commands/update-user-profile.command";
// Value imports, not `import type`: the ValidationPipe reads these classes at
// runtime off the emitDecoratorMetadata attached to each @Body() parameter.
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { USER_SCHEMA } from "./user.schema";

/**
 * Account management for whoever holds the token. There is no user id in any
 * route or body — it always comes from @CurrentUser(), so no request can name
 * someone else's account.
 *
 * Reading the profile lives at GET /auth/me; this controller does not duplicate it.
 *
 * `JwtAuthGuard` protects the whole class. The 401 response is therefore
 * declared once beside `@ApiBearerAuth`. Password-confirming endpoints
 * override its description because they can also reject a wrong password.
 */
@ApiTags("users")
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: "Missing, malformed or expired bearer token",
  schema: errorSchema(HttpStatus.UNAUTHORIZED, "Unauthorized"),
})
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * `PATCH /api/users/me` — updates the current user's public profile.
   *
   * @param user - Authenticated user, from the JWT.
   * @param dto - Email and/or name. Omitted fields are unchanged; `name: null`
   * clears the stored name.
   * @returns 200 with the updated public user.
   * @throws {BadRequestException} 400 — the body fails validation, carries an
   * unknown property, or provides neither supported field.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {NotFoundException} 404 — the token names a user that no longer exists.
   * @throws {ConflictException} 409 — the requested email belongs to another account.
   */
  @Patch("me")
  @ApiOperation({
    summary: "Update the current user's name or email",
    description:
      "At least one field is required. An omitted field is unchanged, while an explicit `null` name clears it. The account owner always comes from the bearer token.",
  })
  @ApiOkResponse({ description: "The updated public user", schema: USER_SCHEMA })
  @ApiBadRequestResponse({
    description:
      "The body failed validation, carried an unknown property, or provided no supported field",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Provide at least one field to update"),
  })
  @ApiNotFoundResponse({
    description: "The token names a user that no longer exists",
    schema: errorSchema(HttpStatus.NOT_FOUND, "User not found"),
  })
  @ApiConflictResponse({
    description: "Another account already uses the requested email",
    schema: errorSchema(HttpStatus.CONFLICT, "An account with that email already exists"),
  })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.commandBus.execute(new UpdateUserProfileCommand(user.id, dto));
  }

  /**
   * `PATCH /api/users/me/password` — replaces the current user's password.
   *
   * @param user - Authenticated user, from the JWT.
   * @param dto - Current password confirmation and the validated replacement.
   * @returns 204 No Content with an empty body.
   * @throws {BadRequestException} 400 — the body fails validation or carries
   * an unknown property.
   * @throws {UnauthorizedException} 401 — no valid bearer token, or the current
   * password is wrong.
   * @throws {NotFoundException} 404 — the token names a user that no longer exists.
   */
  @Patch("me/password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Change the current user's password",
    description:
      "Requires the current password in addition to the bearer token. Existing tokens are not revoked after the change.",
  })
  @ApiNoContentResponse({ description: "The password was changed; the body is empty" })
  @ApiBadRequestResponse({
    description: "The body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, ["Password must be at least 8 characters"]),
  })
  @ApiUnauthorizedResponse({
    description: "No valid bearer token, or the current password is incorrect",
    schema: errorSchema(HttpStatus.UNAUTHORIZED, "Password is incorrect"),
  })
  @ApiNotFoundResponse({
    description: "The token names a user that no longer exists",
    schema: errorSchema(HttpStatus.NOT_FOUND, "User not found"),
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.commandBus.execute(
      new ChangeUserPasswordCommand(user.id, dto.currentPassword, dto.newPassword),
    );
  }

  /**
   * `DELETE /api/users/me` — permanently deletes the account and owned data.
   *
   * Takes a body, which is unusual for DELETE but allowed — the password
   * confirms an irreversible, cascading delete. Note the frontend's
   * `apiClient.delete()` cannot send one yet.
   *
   * @param user - Authenticated user, from the JWT.
   * @param dto - Password confirmation for the destructive action.
   * @returns 204 No Content with an empty body.
   * @throws {BadRequestException} 400 — the body fails validation or carries
   * an unknown property.
   * @throws {UnauthorizedException} 401 — no valid bearer token, or the
   * confirmation password is wrong.
   * @throws {NotFoundException} 404 — the token names a user that no longer exists.
   */
  @Delete("me")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete the current user's account and all their data",
    description:
      "Permanent and cascading: categories, transactions and reset tokens are deleted with the account. The password is re-checked before deletion.",
  })
  @ApiNoContentResponse({ description: "The account and owned data were deleted" })
  @ApiBadRequestResponse({
    description: "The body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, [
      "password must be longer than or equal to 1 characters",
    ]),
  })
  @ApiUnauthorizedResponse({
    description: "No valid bearer token, or the confirmation password is incorrect",
    schema: errorSchema(HttpStatus.UNAUTHORIZED, "Password is incorrect"),
  })
  @ApiNotFoundResponse({
    description: "The token names a user that no longer exists",
    schema: errorSchema(HttpStatus.NOT_FOUND, "User not found"),
  })
  remove(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteAccountDto): Promise<void> {
    return this.commandBus.execute(new DeleteUserCommand(user.id, dto.password));
  }
}
