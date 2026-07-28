import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

import { UsersService } from "../../users.service";
import { GetUserByIdQuery } from "../get-user-by-id.query";

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(private readonly users: UsersService) {}

  execute(query: GetUserByIdQuery): Promise<UserDto | null> {
    return this.users.findById(query.userId);
  }
}
