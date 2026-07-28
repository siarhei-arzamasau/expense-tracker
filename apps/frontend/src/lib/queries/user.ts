import {
  API_ROUTES,
  type ChangePasswordInput,
  type DeleteAccountInput,
  type UpdateProfileInput,
  type UserDto,
} from "@expense-tracker/shared";
import { queryOptions } from "@tanstack/react-query";

import { apiClient, retryApiQuery } from "../api-client";

export const currentUserQueryKey = ["current-user"] as const;

export const currentUserQueryOptions = queryOptions({
  queryKey: currentUserQueryKey,
  queryFn: ({ signal }) => apiClient.get<UserDto>(API_ROUTES.auth.me, { signal }),
  retry: retryApiQuery,
});

export function updateProfile(input: UpdateProfileInput): Promise<UserDto> {
  return apiClient.patch<UserDto>(API_ROUTES.users.me, input);
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiClient.patch<void>(API_ROUTES.users.password, input);
}

export function deleteAccount(input: DeleteAccountInput): Promise<void> {
  return apiClient.delete<void>(API_ROUTES.users.me, input);
}
