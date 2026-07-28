import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
import { DeleteUserCommand } from "../delete-user.command";

/** Delegates authenticated account-deletion commands to the users service. */
@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(private readonly users: UsersService) {}

  /**
   * Re-checks the password and deletes the user with its cascading records.
   *
   * @param command - Authenticated user id and plaintext confirmation password.
   * @returns A promise that resolves after the account has been deleted.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {UnauthorizedException} 401 — the confirmation password is incorrect.
   */
  execute(command: DeleteUserCommand): Promise<void> {
    return this.users.remove(command.userId, command.password);
  }
}
