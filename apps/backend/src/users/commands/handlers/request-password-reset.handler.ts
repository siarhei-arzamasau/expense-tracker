import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UsersService } from "../../users.service";
// Value import: @CommandHandler() needs the class at runtime to key the bus.
import { RequestPasswordResetCommand } from "../request-password-reset.command";

/**
 * The one handler in this module that is not a thin adapter: it owns
 * delivery. UsersService hands back a raw token or null and stops there —
 * composing the URL and logging it is an application concern, not a
 * password-reset-domain one, and keeping it here means the raw token never
 * goes on the bus (see RequestPasswordResetCommand).
 *
 * There is no email service in this template: the link is logged for a
 * developer to copy out of the terminal.
 */
@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler implements ICommandHandler<RequestPasswordResetCommand> {
  private readonly logger = new Logger(RequestPasswordResetHandler.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates and logs a development reset link for a known email.
   *
   * Unknown emails follow the same successful command path but do not produce
   * a link, preventing the caller from using the endpoint to enumerate users.
   *
   * @param command - Email address for which a reset was requested.
   * @returns A promise that resolves after the request has been handled.
   */
  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const rawToken = await this.users.createPasswordResetToken(command.email);
    if (!rawToken) {
      this.logger.log(`Password reset requested for unknown email: ${command.email}`);
      return;
    }

    const webAppUrl = this.config.get<string>("WEB_APP_URL", "http://localhost:3000");
    this.logger.log(`Password reset link: ${webAppUrl}/reset-password?token=${rawToken}`);
  }
}
