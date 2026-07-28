import { Command } from "@nestjs/cqrs";

/**
 * CARRIES A PLAINTEXT PASSWORD AND A LIVE SINGLE-USE RESET TOKEN. See
 * RegisterUserCommand for why that matters on a bus: redact both
 * `newPassword` and `token` before adding any publisher that logs or traces
 * commands — `token` alone is enough to reset this account's password.
 */
export class ResetUserPasswordCommand extends Command<void> {
  constructor(
    readonly token: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
