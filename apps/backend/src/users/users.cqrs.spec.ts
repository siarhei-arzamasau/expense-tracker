import { ConflictException } from "@nestjs/common";
import { CommandBus, CqrsModule, QueryBus } from "@nestjs/cqrs";
import { Test, type TestingModule } from "@nestjs/testing";
import * as argon2 from "argon2";

import { ChangeUserPasswordCommand } from "./commands/change-user-password.command";
import { DeleteUserCommand } from "./commands/delete-user.command";
import { USERS_COMMAND_HANDLERS } from "./commands/handlers";
import { RegisterUserCommand } from "./commands/register-user.command";
import { UpdateUserProfileCommand } from "./commands/update-user-profile.command";
import { GetUserByIdQuery } from "./queries/get-user-by-id.query";
import { USERS_QUERY_HANDLERS } from "./queries/handlers";
import { VerifyUserCredentialsQuery } from "./queries/verify-user-credentials.query";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

/**
 * Proves every command and query actually reaches a registered handler.
 *
 * This is the only test that can catch a handler missing from
 * USERS_COMMAND_HANDLERS / USERS_QUERY_HANDLERS: the unit specs call the
 * service directly, and a forgotten registration surfaces nowhere until a real
 * request throws CommandHandlerNotFoundException in production.
 *
 * The `await moduleRef.init()` below is load-bearing. CqrsModule discovers
 * handlers in onApplicationBootstrap, which compile() alone does not fire — skip
 * init() and every case here fails with "handler not found".
 */
const USER_ID = "018f0000-0000-7000-8000-000000000001";
const PASSWORD = "password123";

let passwordHash: string;

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "demo@example.com",
    passwordHash,
    name: "Demo User",
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("Users CQRS wiring", () => {
  let moduleRef: TestingModule;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let repository: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    repository = {
      findById: jest.fn().mockResolvedValue(userRow()),
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(userRow()),
      update: jest.fn().mockResolvedValue(userRow()),
      delete: jest.fn().mockResolvedValue(true),
    };

    moduleRef = await Test.createTestingModule({
      imports: [CqrsModule.forRoot()],
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        ...USERS_COMMAND_HANDLERS,
        ...USERS_QUERY_HANDLERS,
      ],
    }).compile();

    // Fires onApplicationBootstrap, which is when the buses learn their handlers.
    await moduleRef.init();

    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("routes RegisterUserCommand", async () => {
    await expect(
      commandBus.execute(new RegisterUserCommand("new@example.com", PASSWORD, "New")),
    ).resolves.toMatchObject({ id: USER_ID });
    expect(repository.create).toHaveBeenCalled();
  });

  it("routes UpdateUserProfileCommand", async () => {
    await expect(
      commandBus.execute(new UpdateUserProfileCommand(USER_ID, { name: "Renamed" })),
    ).resolves.toMatchObject({ id: USER_ID });
    expect(repository.update).toHaveBeenCalledWith(USER_ID, { name: "Renamed" });
  });

  it("routes ChangeUserPasswordCommand", async () => {
    await expect(
      commandBus.execute(new ChangeUserPasswordCommand(USER_ID, PASSWORD, "new-password")),
    ).resolves.toBeUndefined();
    expect(repository.update).toHaveBeenCalled();
  });

  it("routes DeleteUserCommand", async () => {
    await expect(
      commandBus.execute(new DeleteUserCommand(USER_ID, PASSWORD)),
    ).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith(USER_ID);
  });

  it("routes GetUserByIdQuery", async () => {
    await expect(queryBus.execute(new GetUserByIdQuery(USER_ID))).resolves.toMatchObject({
      id: USER_ID,
    });
  });

  it("routes VerifyUserCredentialsQuery", async () => {
    repository.findByEmail.mockResolvedValue(userRow());

    await expect(
      queryBus.execute(new VerifyUserCredentialsQuery("demo@example.com", PASSWORD)),
    ).resolves.toMatchObject({ id: USER_ID });
  });

  it("propagates a handler's HTTP exception through the bus unchanged", async () => {
    repository.findByEmail.mockResolvedValue(userRow());

    // The bus must not wrap this: AuthController relies on it surfacing as 409.
    await expect(
      commandBus.execute(new RegisterUserCommand("demo@example.com", PASSWORD)),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("never leaks the password hash across the bus", async () => {
    const user = await queryBus.execute(new GetUserByIdQuery(USER_ID));

    expect(user).not.toBeNull();
    expect(user).not.toHaveProperty("passwordHash");
  });
});
