import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

/**
 * The one place the `users` table meets Prisma — except
 * `UsersService.resetPassword`'s transaction, which writes `users` directly
 * because Prisma's interactive `$transaction` needs both of its writes on
 * the same `tx` client, and this repository's methods aren't shaped to
 * accept one. See that method's docstring for the trade-off.
 *
 * Note this is deliberately inconsistent with CategoriesService and
 * TransactionsService, which inject PrismaService directly. The repository lives
 * here because the users module is the one with a hash to keep contained; the
 * other two were not rewritten to match, since that was not part of the change.
 *
 * Nothing in here throws HTTP exceptions or knows about argon2 — a miss returns
 * null and UsersService decides what that means.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds a user by primary key.
   *
   * @param id - User id to look up.
   * @returns The complete persistence record, including its password hash, or
   * `null` when the id does not exist.
   */
  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Finds the account registered to an exact email address.
   *
   * @param email - Exact email address to look up.
   * @returns The complete persistence record, or `null` when no account uses it.
   */
  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Inserts a user with an already-hashed password.
   *
   * @param data - Persisted account fields. The password must have been hashed
   * by `UsersService`; this repository never accepts plaintext credentials.
   * @returns The newly created persistence record.
   */
  create(data: { email: string; passwordHash: string; name: string | null }): Promise<UserRecord> {
    return this.prisma.user.create({ data });
  }

  /**
   * Updates the supplied subset of mutable account columns.
   *
   * @param id - User id to update.
   * @param data - Columns to replace; omitted keys remain unchanged.
   * @returns The updated persistence record.
   */
  update(
    id: string,
    data: Partial<{ email: string; name: string | null; passwordHash: string }>,
  ): Promise<UserRecord> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /**
   * Returns false when the row was already gone, so the caller can answer 404
   * without a separate lookup. Categories and transactions go with it via
   * onDelete: Cascade.
   *
   * @param id - User id to delete.
   * @returns `true` when a row was deleted; otherwise `false`.
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
  /** Database UUID for the account. */
  id: string;
  /** Unique email used for login. */
  email: string;
  /** Argon2 password hash; never expose this through an API DTO. */
  passwordHash: string;
  /** Optional display name. */
  name: string | null;
  /** Time at which the account row was created. */
  createdAt: Date;
}
