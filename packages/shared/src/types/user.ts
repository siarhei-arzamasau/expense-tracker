/**
 * The user as the API exposes it. Note what is absent: `passwordHash` never
 * appears in any response type, because it never leaves UsersService.
 */
export interface UserDto {
  /** Stable user UUID. */
  id: string;
  /** Email address used to authenticate the account. */
  email: string;
  /** Optional display name. */
  name: string | null;
  /** ISO-8601 timestamp for account creation. */
  createdAt: string;
}

/**
 * Both fields are optional, but a body with neither is rejected by the backend
 * DTO — a PATCH that changes nothing should not quietly answer 200.
 */
export interface UpdateProfileInput {
  /** New display name, `null` to clear it, or omitted to leave it unchanged. */
  name?: string | null;
  /** New email address, or omitted to leave it unchanged. */
  email?: string;
}

/** Request shape for replacing the authenticated user's password. */
export interface ChangePasswordInput {
  /** Existing password used to authorize the change. */
  currentPassword: string;
  /** Replacement password to hash and store. */
  newPassword: string;
}

/** Deleting an account is irreversible and cascades, so it re-checks the password. */
export interface DeleteAccountInput {
  /** Current password used to authorize the irreversible deletion. */
  password: string;
}
