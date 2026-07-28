import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

/**
 * Separate from UsersRepository, whose docstring reserves it for the `users`
 * table. `tokenHash` is a SHA-256 digest, not an argon2 hash — the column has
 * to be searched by value, and argon2 salts each hash so it can only be
 * verified against a known plaintext, never looked up.
 */
@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a digest of a newly issued reset credential.
   *
   * @param data - SHA-256 token digest, expiry time, and owning user id. The
   * raw token must never be passed into this repository.
   * @returns The created password-reset-token record.
   */
  create(data: {
    tokenHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<PasswordResetTokenRecord> {
    return this.prisma.passwordResetToken.create({ data });
  }

  /**
   * Resolves an issued reset credential by its deterministic digest.
   *
   * @param tokenHash - SHA-256 digest derived from the submitted raw token.
   * @returns The matching record, or `null` when the token was never issued or
   * has already been consumed.
   */
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Deletes a reset-token row if it still exists.
   *
   * @param id - Reset-token record id.
   * @returns A promise that resolves after the idempotent deletion attempt.
   */
  async deleteById(id: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { id } });
  }

  /**
   * Invalidates every outstanding reset token for one user.
   *
   * Called before issuing a replacement so only the newest credential can
   * remain usable. A successful reset performs the equivalent deletion inside
   * `UsersService`'s database transaction.
   *
   * @param userId - Owner whose reset credentials should be removed.
   * @returns A promise that resolves after all matching rows are deleted.
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }
}

/** Persistence shape of a password-reset-token row. */
export interface PasswordResetTokenRecord {
  /** Database UUID for the token row. */
  id: string;
  /** SHA-256 digest of the raw reset token. */
  tokenHash: string;
  /** Instant after which the credential must be rejected. */
  expiresAt: Date;
  /** Time at which the credential was issued. */
  createdAt: Date;
  /** User whose password the credential is allowed to reset. */
  userId: string;
}
