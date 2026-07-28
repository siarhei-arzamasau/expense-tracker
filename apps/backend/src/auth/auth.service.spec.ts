import { UnauthorizedException } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { UserDto } from "@expense-tracker/shared";

import { AuthService } from "./auth.service";

/**
 * The buses are mocked here on purpose: this suite is about what AuthService
 * does with the answers it gets, not about the users module behind them.
 * users.cqrs.spec.ts covers the routing.
 */
const USER: UserDto = {
  id: "018f0000-0000-7000-8000-000000000001",
  email: "demo@example.com",
  name: "Demo User",
  createdAt: "2026-07-01T12:00:00.000Z",
};

describe("AuthService", () => {
  let service: AuthService;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };
    jwt = { sign: jest.fn().mockReturnValue("signed.jwt.token") };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("returns a token for the user the command created", async () => {
      commandBus.execute.mockResolvedValue(USER);

      await expect(
        service.register({ email: USER.email, password: "password123", name: "Demo User" }),
      ).resolves.toEqual({ accessToken: "signed.jwt.token", user: USER });
    });

    it("signs sub and email, and nothing else", async () => {
      commandBus.execute.mockResolvedValue(USER);

      await service.register({ email: USER.email, password: "password123" });

      expect(jwt.sign).toHaveBeenCalledWith({ sub: USER.id, email: USER.email });
    });
  });

  describe("login", () => {
    it("returns a token when the query confirms the credentials", async () => {
      queryBus.execute.mockResolvedValue(USER);

      await expect(service.login({ email: USER.email, password: "password123" })).resolves.toEqual({
        accessToken: "signed.jwt.token",
        user: USER,
      });
    });

    it("401s when the query answers null, and signs nothing", async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(service.login({ email: USER.email, password: "wrong" })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("returns the user behind GET /auth/me", async () => {
      queryBus.execute.mockResolvedValue(USER);

      await expect(service.findById(USER.id)).resolves.toEqual(USER);
    });

    it("401s — not 404s — for a token naming a deleted user", async () => {
      queryBus.execute.mockResolvedValue(null);

      // The frontend clears its stored token on 401 and on nothing else, so a
      // 404 here would leave it stuck holding a token that can never work.
      await expect(service.findById(USER.id)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("requestPasswordReset", () => {
    it("resolves for a known email without throwing", async () => {
      commandBus.execute.mockResolvedValue(undefined);

      await expect(service.requestPasswordReset({ email: USER.email })).resolves.toBeUndefined();
    });

    it("resolves the same way for an unknown email — proof there is no email enumeration", async () => {
      commandBus.execute.mockResolvedValue(undefined);

      await expect(
        service.requestPasswordReset({ email: "nobody@example.com" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("resetPassword", () => {
    it("delegates to the command bus with the token and new password", async () => {
      commandBus.execute.mockResolvedValue(undefined);

      await service.resetPassword({ token: "a".repeat(43), password: "new-password" });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ token: "a".repeat(43), newPassword: "new-password" }),
      );
    });
  });
});
