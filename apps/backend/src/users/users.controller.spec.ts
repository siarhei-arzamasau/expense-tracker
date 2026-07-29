import { HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { CommandBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import type { UserDto } from "@expense-tracker/shared";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { ChangeUserPasswordCommand } from "./commands/change-user-password.command";
import { DeleteUserCommand } from "./commands/delete-user.command";
import { UpdateUserProfileCommand } from "./commands/update-user-profile.command";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersController } from "./users.controller";

const USER_ID = "018f0000-0000-7000-8000-000000000001";
const USER: AuthenticatedUser = { id: USER_ID, email: "demo@example.com" };
const USER_DTO: UserDto = {
  ...USER,
  name: "Demo User",
  createdAt: "2026-07-01T12:00:00.000Z",
};

describe("UsersController", () => {
  let controller: UsersController;
  let commandBus: { execute: jest.Mock };

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: CommandBus, useValue: commandBus }],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  it("takes profile ownership from the token and dispatches the submitted fields", async () => {
    const dto = Object.assign(new UpdateProfileDto(), { name: null });
    commandBus.execute.mockResolvedValue(USER_DTO);

    await expect(controller.updateProfile(USER, dto)).resolves.toBe(USER_DTO);
    expect(commandBus.execute).toHaveBeenCalledWith(new UpdateUserProfileCommand(USER_ID, dto));
  });

  it("dispatches both password values and answers with an empty 204 body", async () => {
    const dto = Object.assign(new ChangePasswordDto(), {
      currentPassword: "password123",
      newPassword: "new-password",
    });
    commandBus.execute.mockResolvedValue(undefined);

    await expect(controller.changePassword(USER, dto)).resolves.toBeUndefined();

    expect(commandBus.execute).toHaveBeenCalledWith(
      new ChangeUserPasswordCommand(USER_ID, dto.currentPassword, dto.newPassword),
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, UsersController.prototype.changePassword)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it("dispatches account deletion for the token owner and answers 204", async () => {
    const dto = Object.assign(new DeleteAccountDto(), { password: "password123" });
    commandBus.execute.mockResolvedValue(undefined);

    await expect(controller.remove(USER, dto)).resolves.toBeUndefined();

    expect(commandBus.execute).toHaveBeenCalledWith(new DeleteUserCommand(USER_ID, dto.password));
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, UsersController.prototype.remove)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it("guards every account-management route at class level", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, UsersController) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });
});
