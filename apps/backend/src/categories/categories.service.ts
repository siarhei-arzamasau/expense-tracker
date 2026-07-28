import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@expense-tracker/database";
import type { CategoryDto, CategoryListItemDto } from "@expense-tracker/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

/** Category columns used when mapping a Prisma row to the public DTO. */
interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: Date;
}

/** A category row returned with its transaction relation count. */
interface CategoryListRecord extends CategoryRecord {
  _count: { transactions: number };
}

/**
 * Read and write access to the current user's categories.
 *
 * Every public method scopes its Prisma query by `userId`. Another user's id is
 * reported as missing rather than forbidden, preventing category-id probing.
 * Category names are unique per user, and categories referenced by transactions
 * cannot be deleted because the database relation uses `onDelete: Restrict`.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists the user's categories alphabetically with their transaction counts.
   *
   * @param userId - Owner of the categories.
   * @returns All categories for the user, each with `transactionCount`; an
   * account with no categories receives an empty array.
   */
  async findAll(userId: string): Promise<CategoryListItemDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { name: "asc" },
    });
    return categories.map((category) => this.toListItemDto(category));
  }

  /**
   * Creates a category owned by the user.
   *
   * @param userId - Owner the category is created for; taken from the JWT.
   * @param dto - Validated name and optional colour/icon. Omitted nullable
   * values are stored as `null`.
   * @returns The created category in API shape.
   * @throws {ConflictException} 409 — this user already has a category with
   * the submitted name.
   */
  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    const existing = await this.prisma.category.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`A category named "${dto.name}" already exists`);
    }

    const category = await this.prisma.category.create({
      data: { name: dto.name, color: dto.color ?? null, icon: dto.icon ?? null, userId },
    });
    return this.toDto(category);
  }

  /**
   * Applies a partial update to one of the user's categories.
   *
   * A duplicate-name check excludes the row being updated, so saving an
   * unchanged name succeeds. Omitted fields are untouched; `null` clears
   * `color` or `icon`.
   *
   * @param userId - Owner of the category.
   * @param id - Category id, already parsed as a UUID by the controller.
   * @param dto - Any subset of the create payload.
   * @returns The updated category in API shape.
   * @throws {NotFoundException} 404 — no category with that id belongs to this user.
   * @throws {ConflictException} 409 — another category owned by this user has
   * the submitted name.
   */
  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const current = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!current) {
      throw new NotFoundException("Category not found");
    }

    if (dto.name !== undefined) {
      const existing = await this.prisma.category.findUnique({
        where: { userId_name: { userId, name: dto.name } },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`A category named "${dto.name}" already exists`);
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
      },
    });
    return this.toDto(category);
  }

  /**
   * Deletes one of the user's unused categories.
   *
   * The scoped `deleteMany` settles existence and ownership in one statement.
   * Postgres rejects deletion when a required transaction relation remains;
   * Prisma reports that as P2003, which is translated to a domain-level 409.
   *
   * @param userId - Owner of the category.
   * @param id - Category id, already parsed as a UUID by the controller.
   * @returns Nothing; the controller answers 204 No Content.
   * @throws {NotFoundException} 404 — no category with that id belongs to this user.
   * @throws {ConflictException} 409 — transactions still reference the category.
   */
  async remove(userId: string, id: string): Promise<void> {
    // Scope the delete by userId so one user cannot remove another's category.
    try {
      const { count } = await this.prisma.category.deleteMany({ where: { id, userId } });
      if (count === 0) {
        throw new NotFoundException("Category not found");
      }
    } catch (error) {
      // Transaction.categoryId is required with onDelete: Restrict, so Postgres
      // refuses the delete (P2003) instead of leaving orphaned rows.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Category still has transactions");
      }
      throw error;
    }
  }

  /**
   * Maps a Prisma category row to its public JSON shape.
   *
   * @param category - Category columns selected from Prisma.
   * @returns The DTO with `createdAt` rendered as an ISO-8601 string.
   */
  private toDto(category: CategoryRecord): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt.toISOString(),
    };
  }

  /**
   * Maps a counted Prisma row to the category-list response shape.
   *
   * @param category - Category row including `_count.transactions`.
   * @returns The base category DTO plus its transaction count.
   */
  private toListItemDto(category: CategoryListRecord): CategoryListItemDto {
    return {
      ...this.toDto(category),
      transactionCount: category._count.transactions,
    };
  }
}
