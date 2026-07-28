import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
import { ChangeUserPasswordCommand } from "../change-user-password.command";

/** Delegates password-change commands to the users service. */
@CommandHandler(ChangeUserPasswordCommand)
export class ChangeUserPasswordHandler implements ICommandHandler<ChangeUserPasswordCommand> {
  constructor(private readonly users: UsersService) {}

  /**
   * Verifies the current password and stores a hash of the replacement.
   *
   * @param command - Authenticated user id and the two plaintext passwords.
   * @returns A promise that resolves when the password has been replaced.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {UnauthorizedException} 401 — the current password is incorrect.
   */
  execute(command: ChangeUserPasswordCommand): Promise<void> {
    return this.users.changePassword(command.userId, {
      currentPassword: command.currentPassword,
      newPassword: command.newPassword,
    });
  }
}
