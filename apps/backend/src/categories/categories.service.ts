import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryDto } from "@expense-tracker/shared";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";

interface CategoryRecord {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return categories.map((category) => this.toDto(category));
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    const existing = await this.prisma.category.findUnique({
      where: { userId_name: { userId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`A category named "${dto.name}" already exists`);
    }

    const category = await this.prisma.category.create({
      data: { name: dto.name, color: dto.color ?? null, userId },
    });
    return this.toDto(category);
  }

  async remove(userId: string, id: string): Promise<void> {
    // Scope the delete by userId so one user cannot remove another's category.
    const { count } = await this.prisma.category.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException("Category not found");
    }
  }

  private toDto(category: CategoryRecord): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      createdAt: category.createdAt.toISOString(),
    };
  }
}
