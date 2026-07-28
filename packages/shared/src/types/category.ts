/**
 * A category as the API returns it.
 *
 * Also embedded in `TransactionDto` as a snapshot taken when the transaction
 * was read, which is why a category mutation has to invalidate cached
 * transactions as well as cached categories.
 */
export interface CategoryDto {
  id: string;
  name: string;
  /** Hex colour, or `null` when the user picked none. */
  color: string | null;
  /** Single emoji, or `null`. Validated by grapheme count on the backend. */
  icon: string | null;
  /** ISO-8601 string. */
  createdAt: string;
}

/** A category returned by GET /categories, including its usage count. */
export interface CategoryListItemDto extends CategoryDto {
  transactionCount: number;
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
