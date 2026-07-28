import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
// Value import: @CommandHandler() needs the class at runtime to key the bus.
import { ResetUserPasswordCommand } from "../reset-user-password.command";

/** Delegates reset-token consumption to the users service. */
@CommandHandler(ResetUserPasswordCommand)
export class ResetUserPasswordHandler implements ICommandHandler<ResetUserPasswordCommand> {
  constructor(private readonly users: UsersService) {}

  /**
   * Replaces the password and invalidates the user's reset tokens atomically.
   *
   * @param command - Raw reset token and plaintext replacement password.
   * @returns A promise that resolves after the reset transaction commits.
   * @throws {BadRequestException} 400 — the token is unknown, expired or already used.
   */
  execute(command: ResetUserPasswordCommand): Promise<void> {
    return this.users.resetPassword(command.token, command.newPassword);
  }
}
