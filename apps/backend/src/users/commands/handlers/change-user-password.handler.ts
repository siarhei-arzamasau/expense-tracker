import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
import { ChangeUserPasswordCommand } from "../change-user-password.command";

@CommandHandler(ChangeUserPasswordCommand)
export class ChangeUserPasswordHandler implements ICommandHandler<ChangeUserPasswordCommand> {
  constructor(private readonly users: UsersService) {}

  execute(command: ChangeUserPasswordCommand): Promise<void> {
    return this.users.changePassword(command.userId, {
      currentPassword: command.currentPassword,
      newPassword: command.newPassword,
    });
  }
}
