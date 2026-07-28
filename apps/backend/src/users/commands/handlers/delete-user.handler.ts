import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
import { DeleteUserCommand } from "../delete-user.command";

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(private readonly users: UsersService) {}

  execute(command: DeleteUserCommand): Promise<void> {
    return this.users.remove(command.userId, command.password);
  }
}
