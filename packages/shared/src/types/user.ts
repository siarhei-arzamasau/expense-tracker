/**
 * The user as the API exposes it. Note what is absent: `passwordHash` never
 * appears in any response type, because it never leaves UsersService.
 */
export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

/**
 * Both fields are optional, but a body with neither is rejected by the backend
 * DTO — a PATCH that changes nothing should not quietly answer 200.
 */
export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** Deleting an account is irreversible and cascades, so it re-checks the password. */
export interface DeleteAccountInput {
  password: string;
}
