import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
// Value import: @CommandHandler() needs the class at runtime to key the bus.
import { RegisterUserCommand } from "../register-user.command";

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(private readonly users: UsersService) {}

  execute(command: RegisterUserCommand): Promise<UserDto> {
    return this.users.create({
      email: command.email,
      password: command.password,
      name: command.name,
    });
  }
}
