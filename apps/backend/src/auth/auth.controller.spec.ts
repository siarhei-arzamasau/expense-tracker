import { HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import type { AuthResponse, UserDto } from "@expense-tracker/shared";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedUser } from "./types";

const USER_ID = "018f0000-0000-7000-8000-000000000001";
const USER: UserDto = {
  id: USER_ID,
  email: "demo@example.com",
  name: "Demo User",
  createdAt: "2026-07-01T12:00:00.000Z",
};
const AUTH_RESPONSE: AuthResponse = { accessToken: "signed.jwt.token", user: USER };
const AUTHENTICATED_USER: AuthenticatedUser = { id: USER_ID, email: USER.email };

function createServiceMock() {
  return {
    register: jest.fn(),
    login: jest.fn(),
    findById: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };
}

describe("AuthController", () => {
  let controller: AuthController;
  let service: ReturnType<typeof createServiceMock>;

  beforeEach(async () => {
    service = createServiceMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it("forwards registration and returns the service response unchanged", async () => {
    const dto = Object.assign(new RegisterDto(), {
      email: USER.email,
      password: "password123",
      name: USER.name ?? undefined,
    });
    service.register.mockResolvedValue(AUTH_RESPONSE);

    await expect(controller.register(dto)).resolves.toBe(AUTH_RESPONSE);
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it("forwards login and keeps its explicit 200 status", async () => {
    const dto = Object.assign(new LoginDto(), { email: USER.email, password: "password123" });
    service.login.mockResolvedValue(AUTH_RESPONSE);

    await expect(controller.login(dto)).resolves.toBe(AUTH_RESPONSE);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.login)).toBe(
      HttpStatus.OK,
    );
  });

  it("looks up the current user by the id carried by the token", async () => {
    service.findById.mockResolvedValue(USER);

    await expect(controller.me(AUTHENTICATED_USER)).resolves.toBe(USER);
    expect(service.findById).toHaveBeenCalledWith(USER_ID);
  });

  it("guards only the current-user endpoint", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController)).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.me) as unknown[],
    ).toContain(JwtAuthGuard);
  });

  it("accepts password-reset requests without returning account information", async () => {
    const dto = Object.assign(new ForgotPasswordDto(), { email: USER.email });
    service.requestPasswordReset.mockResolvedValue(undefined);

    await expect(controller.forgotPassword(dto)).resolves.toBeUndefined();

    expect(service.requestPasswordReset).toHaveBeenCalledWith(dto);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.forgotPassword)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it("forwards the reset token and keeps the response body empty", async () => {
    const dto = Object.assign(new ResetPasswordDto(), {
      token: "a".repeat(43),
      password: "new-password",
    });
    service.resetPassword.mockResolvedValue(undefined);

    await expect(controller.resetPassword(dto)).resolves.toBeUndefined();

    expect(service.resetPassword).toHaveBeenCalledWith(dto);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.resetPassword)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });
});
