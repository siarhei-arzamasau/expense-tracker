import {
  API_ROUTES,
  type CategoryDto,
  type CategoryListItemDto,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@expense-tracker/shared";
import { queryOptions } from "@tanstack/react-query";

import { apiClient, ApiError } from "../api-client";

export const categoriesQueryKey = ["categories"] as const;

export const categoriesQueryOptions = queryOptions({
  queryKey: categoriesQueryKey,
  queryFn: () => apiClient.get<CategoryListItemDto[]>(API_ROUTES.categories.root),
  retry: (failureCount, error) => !(error instanceof ApiError && error.isUnauthorized),
});

export function createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
  return apiClient.post<CategoryDto>(API_ROUTES.categories.root, input);
}

export function updateCategory({
  id,
  input,
}: {
  id: string;
  input: UpdateCategoryInput;
}): Promise<CategoryDto> {
  return apiClient.patch<CategoryDto>(API_ROUTES.categories.byId(id), input);
}

export function deleteCategory(id: string): Promise<void> {
  return apiClient.delete<void>(API_ROUTES.categories.byId(id));
}
