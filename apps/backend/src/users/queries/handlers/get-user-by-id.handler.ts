import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
import { GetUserByIdQuery } from "../get-user-by-id.query";

/** Resolves user-id queries through the users service. */
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(private readonly users: UsersService) {}

  /**
   * Looks up a public user record without deciding an HTTP status for a miss.
   *
   * @param query - User id to resolve.
   * @returns The user, or `null` when the id no longer exists.
   */
  execute(query: GetUserByIdQuery): Promise<UserDto | null> {
    return this.users.findById(query.userId);
  }
}
