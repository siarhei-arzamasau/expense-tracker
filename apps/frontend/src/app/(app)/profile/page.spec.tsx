// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import ProfilePage from "./page";

const mocks = vi.hoisted(() => ({
  fetchUser: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/queries/user", () => ({
  currentUserQueryKey: ["current-user"],
  currentUserQueryOptions: {
    queryKey: ["current-user"],
    queryFn: mocks.fetchUser,
    retry: false,
  },
  updateProfile: mocks.updateProfile,
  changePassword: mocks.changePassword,
  deleteAccount: mocks.deleteAccount,
}));
vi.mock("@/lib/use-logout", () => ({ useLogout: () => mocks.logout }));

const USER = {
  id: "018f0000-0000-7000-8000-000000000001",
  email: "demo@example.com",
  name: "Demo User",
  createdAt: "2026-07-01T12:00:00.000Z",
};

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const setQueryData = vi.spyOn(queryClient, "setQueryData");
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { setQueryData, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchUser.mockResolvedValue(USER);
  mocks.updateProfile.mockResolvedValue({ ...USER, name: null });
  mocks.changePassword.mockResolvedValue(undefined);
  mocks.deleteAccount.mockResolvedValue(undefined);
});

describe("ProfilePage", () => {
  it("turns a cleared name into null and seeds the returned user into cache", async () => {
    const { setQueryData, user } = renderWithQuery(<ProfilePage />);
    const name = await screen.findByLabelText("Name");

    // Waiting on the value, not on the field: the inputs mount empty and are
    // filled by the effect that answers GET /auth/me, so `findByLabelText`
    // resolves one render too early and asserting straight off it is a race.
    await waitFor(() => expect(name).toHaveValue("Demo User"));
    expect(screen.getByLabelText("Email")).toHaveValue("demo@example.com");
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        name: null,
        email: "demo@example.com",
      }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Profile updated."));
    expect(setQueryData).toHaveBeenCalledWith(
      ["current-user"],
      expect.objectContaining({ name: null }),
    );
  });

  it("drops password confirmation before sending the change", async () => {
    const { user } = renderWithQuery(<ProfilePage />);
    await screen.findByLabelText("Current password");

    await user.type(screen.getByLabelText("Current password"), "password123");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(mocks.changePassword).toHaveBeenCalledWith({
        currentPassword: "password123",
        newPassword: "new-password",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed.");
  });

  it("logs out only after password-confirmed deletion succeeds", async () => {
    const { user } = renderWithQuery(<ProfilePage />);
    const password = await screen.findByLabelText("Confirm your password");

    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: "Delete account permanently" }));

    await waitFor(() =>
      expect(mocks.deleteAccount).toHaveBeenCalledWith({ password: "password123" }),
    );
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });

  it("keeps the session active and shows the error when account deletion fails", async () => {
    mocks.deleteAccount.mockRejectedValueOnce(new ApiError(400, "Current password is incorrect"));
    const { user } = renderWithQuery(<ProfilePage />);
    const password = await screen.findByLabelText("Confirm your password");

    await user.type(password, "wrong-password");
    await user.click(screen.getByRole("button", { name: "Delete account permanently" }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
  });

  it("shows an ordinary account-loading error", async () => {
    mocks.fetchUser.mockRejectedValueOnce(new ApiError(503, "Profile unavailable"));
    renderWithQuery(<ProfilePage />);

    expect(await screen.findByText("Profile unavailable")).toBeInTheDocument();
  });
});
