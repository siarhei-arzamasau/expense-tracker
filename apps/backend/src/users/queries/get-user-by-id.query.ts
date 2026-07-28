import { Query } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

/**
 * Resolves to null when there is no such user rather than throwing, so the
 * calling module picks the status code. /auth/me needs 401 here, not 404.
 */
export class GetUserByIdQuery extends Query<UserDto | null> {
  /**
   * Creates a user lookup query.
   *
   * @param userId - User id to resolve.
   */
  constructor(readonly userId: string) {
    super();
  }
}
