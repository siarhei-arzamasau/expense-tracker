import { Command } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

/**
 * CARRIES A PLAINTEXT PASSWORD.
 *
 * CommandBus.execute() hands every command to its publisher, so this object is
 * a bus payload. The default in-memory publisher does nothing with it, but if a
 * logging or tracing publisher is ever added, `password` MUST be redacted.
 *
 * Extending Command<UserDto> is what makes `commandBus.execute(new
 * RegisterUserCommand(...))` resolve to UserDto without a type argument.
 */
export class RegisterUserCommand extends Command<UserDto> {
  /**
   * Creates a registration command.
   *
   * @param email - Email address for the new account.
   * @param password - Plaintext password that the users service will hash.
   * @param name - Optional display name; omission is stored as `null`.
   */
  constructor(
    readonly email: string,
    readonly password: string,
    readonly name?: string,
  ) {
    super();
  }
}
