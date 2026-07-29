// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import ForgotPasswordPage from "./page";

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));

vi.mock("@/lib/queries/auth", () => ({ requestPasswordReset: mocks.requestPasswordReset }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ForgotPasswordPage />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestPasswordReset.mockResolvedValue(undefined);
});

describe("ForgotPasswordPage", () => {
  it("replaces the form with the same non-enumerating success message for every account", async () => {
    const user = renderPage();

    await user.type(screen.getByLabelText("Email"), "demo@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(mocks.requestPasswordReset.mock.calls[0]?.[0]).toEqual({
        email: "demo@example.com",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "If an account with that email exists",
    );
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("shows the backend message when the request itself is invalid", async () => {
    mocks.requestPasswordReset.mockRejectedValue(new ApiError(400, "email must be an email"));
    const user = renderPage();

    await user.type(screen.getByLabelText("Email"), "demo@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("email must be an email");
  });
});
