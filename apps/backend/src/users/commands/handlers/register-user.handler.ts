import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
// Value import: @CommandHandler() needs the class at runtime to key the bus.
import { RegisterUserCommand } from "../register-user.command";

/** Delegates user-registration commands to the users service. */
@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(private readonly users: UsersService) {}

  /**
   * Creates an account after checking email uniqueness and hashing the password.
   *
   * @param command - Validated registration values from the auth boundary.
   * @returns The public representation of the created user.
   * @throws {ConflictException} 409 — the email already belongs to an account.
   */
  execute(command: RegisterUserCommand): Promise<UserDto> {
    return this.users.create({
      email: command.email,
      password: command.password,
      name: command.name,
    });
  }
}
