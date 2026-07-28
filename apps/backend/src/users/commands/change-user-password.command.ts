import { Command } from "@nestjs/cqrs";

/**
 * CARRIES PLAINTEXT PASSWORDS — both of them. See RegisterUserCommand for why
 * that matters on a bus: redact these fields before adding any publisher that
 * serialises commands.
 */
export class ChangeUserPasswordCommand extends Command<void> {
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
  ) {
    super();
  }
}
