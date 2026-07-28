import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { UsersService } from "../../users.service";
import { RequestPasswordResetCommand } from "../request-password-reset.command";
import { RequestPasswordResetHandler } from "./request-password-reset.handler";

/**
 * The delivery mechanism (log line, not email) lives entirely in this
 * handler, so it's the one place that can prove a known email produces a
 * URL in the log and an unknown one does not — see
 * users.service.spec.ts for createPasswordResetToken's own behavior.
 */
describe("RequestPasswordResetHandler", () => {
  let handler: RequestPasswordResetHandler;
  let users: { createPasswordResetToken: jest.Mock };
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    users = { createPasswordResetToken: jest.fn() };
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestPasswordResetHandler,
        { provide: UsersService, useValue: users },
        { provide: ConfigService, useValue: { get: () => "http://localhost:3000" } },
      ],
    }).compile();

    handler = moduleRef.get(RequestPasswordResetHandler);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("logs a URL containing WEB_APP_URL and the token for a known email", async () => {
    users.createPasswordResetToken.mockResolvedValue("raw-token-value");

    await handler.execute(new RequestPasswordResetCommand("demo@example.com"));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:3000/reset-password?token=raw-token-value"),
    );
  });

  it("does not log a URL for an unknown email", async () => {
    users.createPasswordResetToken.mockResolvedValue(null);

    await handler.execute(new RequestPasswordResetCommand("nobody@example.com"));

    const loggedMessages = logSpy.mock.calls.map(([message]) => message as string);
    expect(loggedMessages.some((message) => message.includes("reset-password?token="))).toBe(false);
  });
});
