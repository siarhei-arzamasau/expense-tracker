import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
import { UpdateUserProfileCommand } from "../update-user-profile.command";

@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileHandler implements ICommandHandler<UpdateUserProfileCommand> {
  constructor(private readonly users: UsersService) {}

  execute(command: UpdateUserProfileCommand): Promise<UserDto> {
    return this.users.updateProfile(command.userId, command.changes);
  }
}
