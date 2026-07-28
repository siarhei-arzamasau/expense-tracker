export interface CategoryDto {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: string;
}

/** A category returned by GET /categories, including its usage count. */
export interface CategoryListItemDto extends CategoryDto {
  expenseCount: number;
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
}
