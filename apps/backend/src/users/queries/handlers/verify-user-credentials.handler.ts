import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
import { VerifyUserCredentialsQuery } from "../verify-user-credentials.query";

/** Resolves login credential checks through the users service. */
@QueryHandler(VerifyUserCredentialsQuery)
export class VerifyUserCredentialsHandler implements IQueryHandler<VerifyUserCredentialsQuery> {
  constructor(private readonly users: UsersService) {}

  /**
   * Compares a plaintext password with the hash stored for an email address.
   *
   * @param query - Email and plaintext password to verify.
   * @returns The public user when both values match; otherwise `null` for
   * either an unknown email or an incorrect password.
   */
  execute(query: VerifyUserCredentialsQuery): Promise<UserDto | null> {
    return this.users.verifyCredentials(query.email, query.password);
  }
}
