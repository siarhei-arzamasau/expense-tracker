import type { UserDto } from "./user";

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name?: string;
}
