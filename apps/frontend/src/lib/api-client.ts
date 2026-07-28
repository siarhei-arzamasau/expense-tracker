import { API_ROUTES } from "@expense-tracker/shared";

import { authStorage } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const PUBLIC_AUTH_ROUTES = new Set<string>([
  API_ROUTES.auth.register,
  API_ROUTES.auth.login,
  API_ROUTES.auth.forgotPassword,
  API_ROUTES.auth.resetPassword,
]);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export function retryApiQuery(failureCount: number, error: Error): boolean {
  return failureCount < 1 && !(error instanceof ApiError && error.isUnauthorized);
}

/** Nest's exception filter returns `{ statusCode, message, error }`. */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      const { message } = body as { message: unknown };
      // class-validator returns an array of messages, one per failed rule.
      return Array.isArray(message) ? message.join(", ") : String(message);
    }
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = authStorage.get();

  const response = await fetch(`${API_URL}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = new ApiError(response.status, await extractErrorMessage(response));
    if (
      error.isUnauthorized &&
      token &&
      authStorage.get() === token &&
      !PUBLIC_AUTH_ROUTES.has(path)
    ) {
      authStorage.expire();
    }
    throw error;
  }

  // 204 No Content has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
};
