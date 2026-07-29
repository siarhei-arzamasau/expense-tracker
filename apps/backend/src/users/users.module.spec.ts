import { MODULE_METADATA } from "@nestjs/common/constants";

import { USERS_COMMAND_HANDLERS } from "./commands/handlers";
import { PasswordResetTokenRepository } from "./password-reset-token.repository";
import { USERS_QUERY_HANDLERS } from "./queries/handlers";
import { UsersController } from "./users.controller";
import { UsersModule } from "./users.module";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

describe("UsersModule", () => {
  it("registers every CQRS handler and keeps the implementation private", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UsersModule)).toEqual([
      UsersController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UsersModule)).toEqual([
      UsersService,
      UsersRepository,
      PasswordResetTokenRepository,
      ...USERS_COMMAND_HANDLERS,
      ...USERS_QUERY_HANDLERS,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, UsersModule)).toBeUndefined();
  });
});
