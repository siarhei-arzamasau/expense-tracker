export interface CategoryDto {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
}
