import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
import { UpdateUserProfileCommand } from "../update-user-profile.command";

/** Delegates profile-update commands to the users service. */
@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileHandler implements ICommandHandler<UpdateUserProfileCommand> {
  constructor(private readonly users: UsersService) {}

  /**
   * Applies the submitted profile fields to the authenticated user.
   *
   * @param command - User id and the profile fields that were present in the request.
   * @returns The updated public user representation.
   * @throws {BadRequestException} 400 — no field was supplied.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {ConflictException} 409 — the replacement email is already registered.
   */
  execute(command: UpdateUserProfileCommand): Promise<UserDto> {
    return this.users.updateProfile(command.userId, command.changes);
  }
}
