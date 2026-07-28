/**
 * A category as the API returns it.
 *
 * Also embedded in `TransactionDto` as a snapshot taken when the transaction
 * was read, which is why a category mutation has to invalidate cached
 * transactions as well as cached categories.
 */
export interface CategoryDto {
  /** Category UUID. */
  id: string;
  /** User-visible name, unique within one user's categories. */
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
  /** Number of transactions currently assigned to this category. */
  transactionCount: number;
}

/**
 * Request body for `POST /api/categories`.
 *
 * This is the transport shape only. Length, hexadecimal-colour and emoji rules
 * are enforced by `CreateCategoryDto` in the backend.
 */
export interface CreateCategoryInput {
  /** User-visible name. */
  name: string;
  /** Optional hexadecimal colour; `null` stores no colour. */
  color?: string | null;
  /** Optional single emoji; `null` stores no icon. */
  icon?: string | null;
}

/**
 * Request body for `PATCH /api/categories/:id`.
 *
 * An omitted field is unchanged; `null` clears `color` or `icon`.
 */
export interface UpdateCategoryInput {
  /** Replacement user-visible name. */
  name?: string;
  /** Replacement hexadecimal colour, or `null` to clear it. */
  color?: string | null;
  /** Replacement single emoji, or `null` to clear it. */
  icon?: string | null;
}
