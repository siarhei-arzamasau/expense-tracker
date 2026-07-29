// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "./page";

const mocks = vi.hoisted(() => ({
  token: "",
  resetPassword: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ token: mocks.token }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/queries/auth", () => ({ resetPassword: mocks.resetPassword }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ResetPasswordPage />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "";
  mocks.resetPassword.mockResolvedValue(undefined);
});

describe("ResetPasswordPage", () => {
  it.each([
    ["a missing token", ""],
    ["a truncated token", "a".repeat(42)],
    ["an overlong token", "a".repeat(44)],
  ])("rejects %s before showing the form", (_label, token) => {
    mocks.token = token;

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Reset link is invalid or has expired");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("submits only the token and confirmed password, then returns to login", async () => {
    mocks.token = "a".repeat(43);
    const user = renderPage();

    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        token: "a".repeat(43),
        password: "new-password",
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?reset=success"));
  });

  it("does not submit mismatched passwords", async () => {
    mocks.token = "a".repeat(43);
    const user = renderPage();

    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  // Both fields go through PasswordInput rather than a bare Input: this is the
  // one form where the password being set cannot be checked anywhere else, and
  // it was the last one in the app still missing the toggle.
  it("reveals each password field on its own, not both at once", async () => {
    mocks.token = "a".repeat(43);
    const user = renderPage();

    const newPassword = screen.getByLabelText("New password");
    const confirmPassword = screen.getByLabelText("Confirm new password");
    const toggles = screen.getAllByRole("button", { name: "Show password" });

    expect(toggles).toHaveLength(2);
    expect(newPassword).toHaveAttribute("type", "password");

    await user.click(toggles[0]);

    expect(newPassword).toHaveAttribute("type", "text");
    expect(confirmPassword).toHaveAttribute("type", "password");
  });
});
