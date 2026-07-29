import { API_ROUTES } from "@expense-tracker/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  changePassword,
  currentUserQueryKey,
  currentUserQueryOptions,
  deleteAccount,
  updateProfile,
} from "./user";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock("../api-client", () => ({
  apiClient: mocks,
  retryApiQuery: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("current-user queries", () => {
  it("uses the stable key and forwards cancellation to GET /auth/me", async () => {
    const signal = new AbortController().signal;
    mocks.get.mockResolvedValue({});

    await (
      currentUserQueryOptions.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>
    )({ signal });

    expect(currentUserQueryOptions.queryKey).toEqual(currentUserQueryKey);
    expect(mocks.get).toHaveBeenCalledWith(API_ROUTES.auth.me, { signal });
  });

  it("uses the shared profile and password routes", async () => {
    const profile = { name: null };
    const passwords = { currentPassword: "password123", newPassword: "new-password" };
    mocks.patch.mockResolvedValue({});

    await updateProfile(profile);
    await changePassword(passwords);

    expect(mocks.patch).toHaveBeenNthCalledWith(1, API_ROUTES.users.me, profile);
    expect(mocks.patch).toHaveBeenNthCalledWith(2, API_ROUTES.users.password, passwords);
  });

  it("sends password confirmation in the DELETE request body", async () => {
    const input = { password: "password123" };
    mocks.delete.mockResolvedValue(undefined);

    await deleteAccount(input);

    expect(mocks.delete).toHaveBeenCalledWith(API_ROUTES.users.me, input);
  });
});
