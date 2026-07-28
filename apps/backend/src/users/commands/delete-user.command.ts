import { Command } from "@nestjs/cqrs";

/**
 * CARRIES A PLAINTEXT PASSWORD — see RegisterUserCommand.
 *
 * The password is re-checked here rather than trusted from the token, because
 * the delete cascades through every category and expense the user owns.
 */
export class DeleteUserCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly password: string,
  ) {
    super();
  }
}
