import type { UserDto } from "./user";

/** Successful registration or login response. */
export interface AuthResponse {
  /** Signed bearer token used in the `Authorization` header. */
  accessToken: string;
  /** Public account snapshot; password hashes never cross this boundary. */
  user: UserDto;
}

/** Credentials sent to the login endpoint. */
export interface LoginInput {
  /** Registered account email. */
  email: string;
  /** Plaintext password, used only for verification. */
  password: string;
}

/** Registration payload: login credentials plus an optional display name. */
export interface RegisterInput extends LoginInput {
  /** Optional display name; omission is represented as `null` in `UserDto`. */
  name?: string;
}

/** Password-recovery request that deliberately does not reveal account existence. */
export interface ForgotPasswordInput {
  /** Address for which to request a reset link. */
  email: string;
}

/** Credentials used to complete a password reset. */
export interface ResetPasswordInput {
  /** Opaque, single-use token from the reset link. */
  token: string;
  /** Replacement plaintext password. */
  password: string;
}
