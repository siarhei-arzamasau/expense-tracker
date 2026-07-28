import { Command } from "@nestjs/cqrs";

/**
 * CARRIES A PLAINTEXT PASSWORD AND A LIVE SINGLE-USE RESET TOKEN. See
 * RegisterUserCommand for why that matters on a bus: redact both
 * `newPassword` and `token` before adding any publisher that logs or traces
 * commands — `token` alone is enough to reset this account's password.
 */
export class ResetUserPasswordCommand extends Command<void> {
  /**
   * Creates a command that consumes a password-reset credential.
   *
   * @param token - Raw single-use token from the reset link.
   * @param newPassword - Plaintext replacement password to hash and store.
   */
  constructor(
    readonly token: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
