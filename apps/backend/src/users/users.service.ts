import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { UserDto } from "@expense-tracker/shared";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { PasswordResetTokenRepository } from "./password-reset-token.repository";
import { UsersRepository, type UserRecord } from "./users.repository";

/** Reset links stop working this many minutes after being issued. */
const PASSWORD_RESET_TTL_MINUTES = 60;

/** One indistinguishable response for unknown, expired and already-used reset tokens. */
const INVALID_RESET_TOKEN_MESSAGE = "Reset link is invalid or has expired";

/**
 * Everything the application knows how to do to a user.
 *
 * The command and query handlers are thin adapters over these methods — the
 * logic lives here so it stays unit-testable without booting a bus.
 *
 * The password hash never leaves this class: every method returns UserDto.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwordResetTokens: PasswordResetTokenRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates an account after enforcing email uniqueness and hashing its password.
   *
   * @param input - Validated registration fields. An omitted name is stored as `null`.
   * @returns The public user shape; `passwordHash` never leaves this service.
   * @throws {ConflictException} 409 — another account already uses `input.email`.
   */
  async create(input: { email: string; password: string; name?: string }): Promise<UserDto> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("An account with that email already exists");
    }

    const user = await this.users.create({
      email: input.email,
      name: input.name ?? null,
      passwordHash: await argon2.hash(input.password),
    });

    return this.toDto(user);
  }

  /**
   * Returns null for both "no such email" and "wrong password" — the caller
   * turns that into one indistinguishable response, so it does not leak which
   * emails are registered.
   *
   * @param email - Email to look up.
   * @param password - Plaintext candidate checked against the stored argon2 hash.
   * @returns The public user when both credentials match; otherwise `null`.
   */
  async verifyCredentials(email: string, password: string): Promise<UserDto | null> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return null;
    }
    return this.toDto(user);
  }

  /**
   * Null rather than a NotFoundException: a token naming a deleted user has to
   * come back as 401, and only the calling module knows that.
   *
   * @param id - User id from the JWT subject.
   * @returns The public user, or `null` when the row no longer exists.
   */
  async findById(id: string): Promise<UserDto | null> {
    const user = await this.users.findById(id);
    return user ? this.toDto(user) : null;
  }

  /**
   * Applies the supplied profile fields while leaving omitted ones unchanged.
   *
   * The empty-body rule is cross-field and therefore lives here rather than on
   * one DTO property. An email uniqueness check excludes the current user, so
   * saving an unchanged email remains valid.
   *
   * @param id - User to update.
   * @param changes - Email and/or name; `name: null` clears the stored name.
   * @returns The updated public user.
   * @throws {BadRequestException} 400 — neither supported field was supplied.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {ConflictException} 409 — another account already uses the new email.
   */
  async updateProfile(
    id: string,
    changes: { name?: string | null; email?: string },
  ): Promise<UserDto> {
    // A cross-field rule, so it cannot live on a single-property decorator.
    // Without it a PATCH carrying nothing would answer 200 and change nothing.
    if (changes.name === undefined && changes.email === undefined) {
      throw new BadRequestException("Provide at least one field to update");
    }

    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (changes.email !== undefined && changes.email !== user.email) {
      const owner = await this.users.findByEmail(changes.email);
      if (owner) {
        throw new ConflictException("An account with that email already exists");
      }
    }

    // Spread only the keys that were actually sent: passing `email: undefined`
    // to Prisma is a no-op, but passing `name: undefined` would be too, and we
    // do want an explicit null to clear the name.
    const updated = await this.users.update(id, {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.email !== undefined ? { email: changes.email } : {}),
    });

    return this.toDto(updated);
  }

  /**
   * Replaces a password after verifying the current plaintext password.
   *
   * @param id - User whose password is changing.
   * @param passwords - Current password confirmation and validated replacement.
   * @returns Nothing; the controller answers 204 No Content.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {UnauthorizedException} 401 — the current password is wrong.
   */
  async changePassword(
    id: string,
    passwords: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const user = await this.assertPassword(id, passwords.currentPassword);
    await this.users.update(user.id, {
      passwordHash: await argon2.hash(passwords.newPassword),
    });
  }

  /**
   * Re-checks the password because this is irreversible: the cascade takes
   * every category and expense with it, and a stolen token alone must not be
   * enough to trigger that.
   *
   * @param id - User to delete.
   * @param password - Plaintext confirmation checked immediately before deletion.
   * @returns Nothing; the controller answers 204 No Content.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {UnauthorizedException} 401 — the confirmation password is wrong.
   */
  async remove(id: string, password: string): Promise<void> {
    await this.assertPassword(id, password);
    const deleted = await this.users.delete(id);
    if (!deleted) {
      throw new NotFoundException("User not found");
    }
  }

  /**
   * Loads a user and verifies a plaintext password against the stored hash.
   *
   * @param id - User to load.
   * @param password - Plaintext candidate.
   * @returns The database record after successful verification.
   * @throws {NotFoundException} 404 — the user no longer exists.
   * @throws {UnauthorizedException} 401 — the password is wrong.
   */
  private async assertPassword(id: string, password: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException("Password is incorrect");
    }
    return user;
  }

  /**
   * Returns the raw token for an unknown email too, exactly like
   * `verifyCredentials` returns null for both a bad email and a bad
   * password — the caller must not be able to tell the two cases apart.
   * `null` here means "no email lookup happened, don't log a URL."
   *
   * Existing reset tokens for the account are deleted before a replacement is
   * issued, so only the newest link can work.
   *
   * @param email - Address supplied to the forgot-password endpoint.
   * @returns A raw, single-use token for a known email; otherwise `null`.
   */
  async createPasswordResetToken(email: string): Promise<string | null> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return null;
    }

    await this.passwordResetTokens.deleteAllForUser(user.id);

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
    await this.passwordResetTokens.create({
      tokenHash: this.hashToken(rawToken),
      expiresAt,
      userId: user.id,
    });

    return rawToken;
  }

  /**
   * The password update and the token wipe run in one transaction — two
   * separate writes would leave the link live against the new password if
   * the second write failed. That's why this bypasses UsersRepository and
   * PasswordResetTokenRepository for the write itself: a transaction needs
   * both queries to run against the same `tx` client.
   *
   * @param rawToken - Base64url token from the reset link.
   * @param newPassword - Validated replacement password in plaintext.
   * @returns Nothing; a successful reset consumes all reset tokens for the user.
   * @throws {BadRequestException} 400 — the token is unknown, expired or already used.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.passwordResetTokens.findByTokenHash(this.hashToken(rawToken));
    if (!record) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    if (record.expiresAt < new Date()) {
      await this.passwordResetTokens.deleteById(record.id);
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    });
  }

  /**
   * Produces the deterministic lookup key stored for a reset token.
   *
   * @param rawToken - Unhashed reset credential.
   * @returns Lowercase hexadecimal SHA-256 digest.
   */
  private hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  /**
   * Removes persistence-only fields from a user record.
   *
   * @param user - Database record including the password hash.
   * @returns Public API shape with an ISO-8601 creation timestamp.
   */
  private toDto(user: UserRecord): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
