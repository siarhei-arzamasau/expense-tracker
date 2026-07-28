import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
import { VerifyUserCredentialsQuery } from "../verify-user-credentials.query";

@QueryHandler(VerifyUserCredentialsQuery)
export class VerifyUserCredentialsHandler implements IQueryHandler<VerifyUserCredentialsQuery> {
  constructor(private readonly users: UsersService) {}

  execute(query: VerifyUserCredentialsQuery): Promise<UserDto | null> {
    return this.users.verifyCredentials(query.email, query.password);
  }
}
