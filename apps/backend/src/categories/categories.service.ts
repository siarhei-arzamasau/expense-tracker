import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@expense-tracker/database";
import type { CategoryDto, CategoryListItemDto } from "@expense-tracker/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: Date;
}

interface CategoryListRecord extends CategoryRecord {
  _count: { transactions: number };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<CategoryListItemDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { name: "asc" },
    });
    return categories.map((category) => this.toListItemDto(category));
  }

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

  private toDto(category: CategoryRecord): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.createdAt.toISOString(),
    };
  }

  private toListItemDto(category: CategoryListRecord): CategoryListItemDto {
    return {
      ...this.toDto(category),
      transactionCount: category._count.transactions,
    };
  }
}
