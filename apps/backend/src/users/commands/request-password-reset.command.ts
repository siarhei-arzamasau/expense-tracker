import { Command } from "@nestjs/cqrs";

/**
 * Resolves to void on every outcome — an unknown email is not an error, it is
 * one of two normal paths, and the difference must not be visible outside
 * UsersService and the handler (see RequestPasswordResetHandler).
 */
export class RequestPasswordResetCommand extends Command<void> {
  /**
   * Creates a password-reset request command.
   *
   * @param email - Account email to look up without exposing whether it exists.
   */
  constructor(readonly email: string) {
    super();
  }
}
