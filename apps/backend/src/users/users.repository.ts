import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

/**
 * The one place the `users` table meets Prisma.
 *
 * Note this is deliberately inconsistent with CategoriesService and
 * ExpensesService, which inject PrismaService directly. The repository lives
 * here because the users module is the one with a hash to keep contained; the
 * other two were not rewritten to match, since that was not part of the change.
 *
 * Nothing in here throws HTTP exceptions or knows about argon2 — a miss returns
 * null and UsersService decides what that means.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: { email: string; passwordHash: string; name: string | null }): Promise<UserRecord> {
    return this.prisma.user.create({ data });
  }

  update(
    id: string,
    data: Partial<{ email: string; name: string | null; passwordHash: string }>,
  ): Promise<UserRecord> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /**
   * Returns false when the row was already gone, so the caller can answer 404
   * without a separate lookup. Categories and expenses go with it via
   * onDelete: Cascade.
   */
  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.user.deleteMany({ where: { id } });
    return count > 0;
  }
}

/**
 * The columns this module reads. Declared here rather than imported from the
 * generated client so the shape it depends on is visible in one place.
 */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: Date;
}
