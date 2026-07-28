import { Body, Controller, Delete, HttpCode, HttpStatus, Patch, UseGuards } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { UserDto } from "@expense-tracker/shared";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { ChangeUserPasswordCommand } from "./commands/change-user-password.command";
import { DeleteUserCommand } from "./commands/delete-user.command";
import { UpdateUserProfileCommand } from "./commands/update-user-profile.command";
// Value imports, not `import type`: the ValidationPipe reads these classes at
// runtime off the emitDecoratorMetadata attached to each @Body() parameter.
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

/**
 * Account management for whoever holds the token. There is no user id in any
 * route or body — it always comes from @CurrentUser(), so no request can name
 * someone else's account.
 *
 * Reading the profile lives at GET /auth/me; this controller does not duplicate it.
 */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch("me")
  @ApiOperation({ summary: "Update the current user's name or email" })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.commandBus.execute(new UpdateUserProfileCommand(user.id, dto));
  }

  @Patch("me/password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Change the current user's password" })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.commandBus.execute(
      new ChangeUserPasswordCommand(user.id, dto.currentPassword, dto.newPassword),
    );
  }

  /**
   * Takes a body, which is unusual for DELETE but allowed — the password
   * confirms an irreversible, cascading delete. Note the frontend's
   * apiClient.delete() cannot send one yet.
   */
  @Delete("me")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete the current user's account and all their data" })
  remove(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteAccountDto): Promise<void> {
    return this.commandBus.execute(new DeleteUserCommand(user.id, dto.password));
  }
}
