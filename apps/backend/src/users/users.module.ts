import { Module } from "@nestjs/common";

import { USERS_COMMAND_HANDLERS } from "./commands/handlers";
import { PasswordResetTokenRepository } from "./password-reset-token.repository";
import { USERS_QUERY_HANDLERS } from "./queries/handlers";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

/**
 * Exports nothing, on purpose.
 *
 * Other modules reach users only by putting a command or query on the bus —
 * see commands/ and queries/, which are the module's entire public surface.
 * AuthModule holds no reference to UsersService or UsersRepository, which is
 * why it can stay unaware of Prisma.
 */
@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    PasswordResetTokenRepository,
    ...USERS_COMMAND_HANDLERS,
    ...USERS_QUERY_HANDLERS,
  ],
})
export class UsersModule {}
