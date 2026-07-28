import {
  API_ROUTES,
  type AuthResponse,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@expense-tracker/shared";

import { apiClient } from "../api-client";

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>(API_ROUTES.auth.login, input);
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>(API_ROUTES.auth.register, input);
}

export function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  return apiClient.post<void>(API_ROUTES.auth.forgotPassword, input);
}

export function resetPassword(input: ResetPasswordInput): Promise<void> {
  return apiClient.post<void>(API_ROUTES.auth.resetPassword, input);
}
