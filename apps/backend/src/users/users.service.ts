import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { UserDto } from "@expense-tracker/shared";
import * as argon2 from "argon2";

import { UsersRepository, type UserRecord } from "./users.repository";

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
  constructor(private readonly users: UsersRepository) {}

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
   */
  async findById(id: string): Promise<UserDto | null> {
    const user = await this.users.findById(id);
    return user ? this.toDto(user) : null;
  }

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
   */
  async remove(id: string, password: string): Promise<void> {
    await this.assertPassword(id, password);
    const deleted = await this.users.delete(id);
    if (!deleted) {
      throw new NotFoundException("User not found");
    }
  }

  /** Loads the user and confirms the password, or throws. */
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

  private toDto(user: UserRecord): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
