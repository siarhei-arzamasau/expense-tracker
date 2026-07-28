import { Query } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

/**
 * CARRIES A PLAINTEXT PASSWORD. QueryBus.execute() publishes every query to its
 * publisher, exactly as the command bus does — redact this field before adding
 * a publisher that serialises queries.
 *
 * A query and not a command: comparing a hash has no side effect. Null covers
 * both "no such email" and "wrong password"; AuthService turns that into 401.
 */
export class VerifyUserCredentialsQuery extends Query<UserDto | null> {
  /**
   * Creates a credential-verification query.
   *
   * @param email - Email address to look up.
   * @param password - Plaintext password to compare with the stored hash.
   */
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super();
  }
}
