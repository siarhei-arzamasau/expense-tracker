import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
// Value import: @CommandHandler() needs the class at runtime to key the bus.
import { ResetUserPasswordCommand } from "../reset-user-password.command";

@CommandHandler(ResetUserPasswordCommand)
export class ResetUserPasswordHandler implements ICommandHandler<ResetUserPasswordCommand> {
  constructor(private readonly users: UsersService) {}

  execute(command: ResetUserPasswordCommand): Promise<void> {
    return this.users.resetPassword(command.token, command.newPassword);
  }
}
