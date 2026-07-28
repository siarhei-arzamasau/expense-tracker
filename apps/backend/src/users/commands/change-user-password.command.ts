import { Command } from "@nestjs/cqrs";

/**
 * CARRIES PLAINTEXT PASSWORDS — both of them. See RegisterUserCommand for why
 * that matters on a bus: redact these fields before adding any publisher that
 * serialises commands.
 */
export class ChangeUserPasswordCommand extends Command<void> {
  /**
   * Creates a password-change command.
   *
   * @param userId - Authenticated user's id.
   * @param currentPassword - Plaintext password to verify before changing it.
   * @param newPassword - Plaintext replacement password to hash and store.
   */
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
