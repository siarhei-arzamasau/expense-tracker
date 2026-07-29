import { API_ROUTES } from "@expense-tracker/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { login, register, requestPasswordReset, resetPassword } from "./auth";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../api-client", () => ({ apiClient: { post: mocks.post } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authentication queries", () => {
  it.each([
    ["login", login, API_ROUTES.auth.login, { email: "demo@example.com", password: "password123" }],
    [
      "registration",
      register,
      API_ROUTES.auth.register,
      { email: "demo@example.com", password: "password123" },
    ],
    [
      "password-reset request",
      requestPasswordReset,
      API_ROUTES.auth.forgotPassword,
      { email: "demo@example.com" },
    ],
    [
      "password reset",
      resetPassword,
      API_ROUTES.auth.resetPassword,
      { token: "a".repeat(43), password: "new-password" },
    ],
  ] as const)("posts %s to its shared route", async (_label, action, route, input) => {
    mocks.post.mockResolvedValue(undefined);

    await action(input as never);

    expect(mocks.post).toHaveBeenCalledWith(route, input);
  });
});
