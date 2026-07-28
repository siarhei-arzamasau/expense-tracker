import { Command } from "@nestjs/cqrs";

/**
 * CARRIES A PLAINTEXT PASSWORD. See RegisterUserCommand for why that matters
 * on a bus: redact `newPassword` before adding any publisher that logs or
 * traces commands.
 */
export class ResetUserPasswordCommand extends Command<void> {
  constructor(
    readonly token: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
