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

  create(data: {
    tokenHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<PasswordResetTokenRecord> {
    return this.prisma.passwordResetToken.create({ data });
  }

  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { id } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }
}

export interface PasswordResetTokenRecord {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  userId: string;
}
