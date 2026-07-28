import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { PasswordResetTokenRepository } from "./password-reset-token.repository";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

/** Minimal in-memory stand-in — these tests never touch Postgres. */
function createRepositoryMock() {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function createTokenRepositoryMock() {
  return {
    create: jest.fn(),
    findByTokenHash: jest.fn(),
    deleteById: jest.fn(),
    deleteAllForUser: jest.fn(),
  };
}

/**
 * Records the writes made inside the `$transaction` callback instead of
 * actually running one — these tests assert on what was written, not on
 * transactional atomicity, which no mock can prove anyway.
 */
function createPrismaMock() {
  const userUpdate = jest.fn();
  const tokenDeleteMany = jest.fn();
  return {
    userUpdate,
    tokenDeleteMany,
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        user: { update: userUpdate },
        passwordResetToken: { deleteMany: tokenDeleteMany },
      });
    }),
  };
}

const USER_ID = "018f0000-0000-7000-8000-000000000001";
const OTHER_USER_ID = "018f0000-0000-7000-8000-000000000002";
const PASSWORD = "password123";

/** Hashing is slow by design, so hash once and reuse across the suite. */
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

describe("UsersService", () => {
  let service: UsersService;
  let repository: ReturnType<typeof createRepositoryMock>;
  let tokenRepository: ReturnType<typeof createTokenRepositoryMock>;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    repository = createRepositoryMock();
    tokenRepository = createTokenRepositoryMock();
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: PasswordResetTokenRepository, useValue: tokenRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe("create", () => {
    it("stores a hash, never the plaintext password", async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockImplementation((data: { passwordHash: string }) =>
        Promise.resolve(userRow(data)),
      );

      await service.create({ email: "new@example.com", password: PASSWORD, name: "New" });

      const [created] = repository.create.mock.calls[0] as [{ passwordHash: string }];
      expect(created.passwordHash).not.toBe(PASSWORD);
      await expect(argon2.verify(created.passwordHash, PASSWORD)).resolves.toBe(true);
    });

    it("never returns the hash to the caller", async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(userRow());

      const dto = await service.create({ email: "demo@example.com", password: PASSWORD });

      expect(dto).not.toHaveProperty("passwordHash");
      expect(dto).toEqual({
        id: USER_ID,
        email: "demo@example.com",
        name: "Demo User",
        createdAt: "2026-07-01T12:00:00.000Z",
      });
    });

    it("rejects an email that is already taken", async () => {
      repository.findByEmail.mockResolvedValue(userRow());

      await expect(
        service.create({ email: "demo@example.com", password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("verifyCredentials", () => {
    it("returns the user when the password matches", async () => {
      repository.findByEmail.mockResolvedValue(userRow());

      await expect(service.verifyCredentials("demo@example.com", PASSWORD)).resolves.toMatchObject({
        id: USER_ID,
      });
    });

    it("returns null for a wrong password", async () => {
      repository.findByEmail.mockResolvedValue(userRow());

      await expect(service.verifyCredentials("demo@example.com", "wrong")).resolves.toBeNull();
    });

    it("returns null for an unknown email, indistinguishably from a wrong password", async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.verifyCredentials("nobody@example.com", PASSWORD)).resolves.toBeNull();
    });
  });

  describe("findById", () => {
    it("returns null instead of throwing, so the caller picks the status code", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById(USER_ID)).resolves.toBeNull();
    });
  });

  describe("updateProfile", () => {
    it("rejects a change set with no fields", async () => {
      await expect(service.updateProfile(USER_ID, {})).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("rejects an email owned by somebody else", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.findByEmail.mockResolvedValue(userRow({ id: OTHER_USER_ID }));

      await expect(
        service.updateProfile(USER_ID, { email: "taken@example.com" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("allows re-submitting the address the user already has", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.update.mockResolvedValue(userRow());

      await expect(
        service.updateProfile(USER_ID, { email: "demo@example.com" }),
      ).resolves.toMatchObject({ email: "demo@example.com" });
      // Same address as the current one, so uniqueness is never questioned.
      expect(repository.findByEmail).not.toHaveBeenCalled();
    });

    it("passes an explicit null through to clear the name", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.update.mockResolvedValue(userRow({ name: null }));

      await service.updateProfile(USER_ID, { name: null });

      expect(repository.update).toHaveBeenCalledWith(USER_ID, { name: null });
    });

    it("leaves out fields that were not sent", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.update.mockResolvedValue(userRow({ name: "Renamed" }));

      await service.updateProfile(USER_ID, { name: "Renamed" });

      expect(repository.update).toHaveBeenCalledWith(USER_ID, { name: "Renamed" });
    });

    it("404s when the user is gone", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updateProfile(USER_ID, { name: "X" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("changePassword", () => {
    it("rejects a wrong current password without writing anything", async () => {
      repository.findById.mockResolvedValue(userRow());

      await expect(
        service.changePassword(USER_ID, { currentPassword: "wrong", newPassword: "new-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("writes a hash of the new password, not the password itself", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.update.mockResolvedValue(userRow());

      await service.changePassword(USER_ID, {
        currentPassword: PASSWORD,
        newPassword: "new-password",
      });

      const [, written] = repository.update.mock.calls[0] as [string, { passwordHash: string }];
      expect(written.passwordHash).not.toBe("new-password");
      await expect(argon2.verify(written.passwordHash, "new-password")).resolves.toBe(true);
      // And the old password no longer opens it.
      await expect(argon2.verify(written.passwordHash, PASSWORD)).resolves.toBe(false);
    });

    it("404s when the user is gone", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.changePassword(USER_ID, {
          currentPassword: PASSWORD,
          newPassword: "new-password",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("remove", () => {
    it("refuses to delete on a wrong password", async () => {
      repository.findById.mockResolvedValue(userRow());

      await expect(service.remove(USER_ID, "wrong")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("deletes once the password checks out", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.delete.mockResolvedValue(true);

      await expect(service.remove(USER_ID, PASSWORD)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith(USER_ID);
    });

    it("404s when the row vanished between the check and the delete", async () => {
      repository.findById.mockResolvedValue(userRow());
      repository.delete.mockResolvedValue(false);

      await expect(service.remove(USER_ID, PASSWORD)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("createPasswordResetToken", () => {
    it("returns null for an unknown email and writes nothing", async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.createPasswordResetToken("nobody@example.com")).resolves.toBeNull();
      expect(tokenRepository.deleteAllForUser).not.toHaveBeenCalled();
      expect(tokenRepository.create).not.toHaveBeenCalled();
    });

    it("returns the raw token but stores only its SHA-256 hash", async () => {
      repository.findByEmail.mockResolvedValue(userRow());
      tokenRepository.create.mockResolvedValue({});

      const rawToken = await service.createPasswordResetToken("demo@example.com");

      expect(rawToken).toEqual(expect.any(String));
      const [written] = tokenRepository.create.mock.calls[0] as [{ tokenHash: string }];
      expect(written.tokenHash).not.toBe(rawToken);
      expect(
        createHash("sha256")
          .update(rawToken as string)
          .digest("hex"),
      ).toBe(written.tokenHash);
    });

    it("deletes the user's previous tokens before creating the new one", async () => {
      repository.findByEmail.mockResolvedValue(userRow());
      tokenRepository.create.mockResolvedValue({});

      await service.createPasswordResetToken("demo@example.com");

      expect(tokenRepository.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
      const deleteOrder = tokenRepository.deleteAllForUser.mock.invocationCallOrder[0];
      const createOrder = tokenRepository.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });
  });

  describe("resetPassword", () => {
    function tokenRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "token-1",
        tokenHash: createHash("sha256").update("raw-token").digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
        userId: USER_ID,
        ...overrides,
      };
    }

    it("rejects an unknown token", async () => {
      tokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(service.resetPassword("raw-token", "new-password")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects and deletes an expired token", async () => {
      tokenRepository.findByTokenHash.mockResolvedValue(
        tokenRow({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.resetPassword("raw-token", "new-password")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tokenRepository.deleteById).toHaveBeenCalledWith("token-1");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("writes an argon2 hash of the new password and clears the user's tokens", async () => {
      tokenRepository.findByTokenHash.mockResolvedValue(tokenRow());

      await service.resetPassword("raw-token", "new-password");

      const [{ data }] = prisma.userUpdate.mock.calls[0] as [{ data: { passwordHash: string } }];
      expect(data.passwordHash).not.toBe("new-password");
      await expect(argon2.verify(data.passwordHash, "new-password")).resolves.toBe(true);
      expect(prisma.tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });

    it("rejects a second use of the same token (one-time use)", async () => {
      // Simulates the token already having been consumed and deleted.
      tokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(service.resetPassword("raw-token", "new-password")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
