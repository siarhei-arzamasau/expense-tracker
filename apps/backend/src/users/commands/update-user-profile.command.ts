import { Command } from "@nestjs/cqrs";
import type { UserDto } from "@expense-tracker/shared";

/**
 * `undefined` means "leave this field alone"; an explicit `null` name clears it.
 * A command with neither field set is rejected by UsersService.
 */
export class UpdateUserProfileCommand extends Command<UserDto> {
  constructor(
    readonly userId: string,
    readonly changes: { name?: string | null; email?: string },
  ) {
    super();
  }
}
