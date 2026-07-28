import { Command } from "@nestjs/cqrs";

/**
 * CARRIES A PLAINTEXT PASSWORD — see RegisterUserCommand.
 *
 * The password is re-checked here rather than trusted from the token, because
 * the delete cascades through every category and transaction the user owns.
 */
export class DeleteUserCommand extends Command<void> {
  /**
   * Creates an account-deletion command.
   *
   * @param userId - Authenticated user's id.
   * @param password - Plaintext password to verify before deleting the account.
   */
  constructor(
    readonly userId: string,
    readonly password: string,
  ) {
    super();
  }
}
