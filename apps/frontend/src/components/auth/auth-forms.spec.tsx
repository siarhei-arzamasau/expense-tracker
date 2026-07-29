// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  setToken: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/queries/auth", () => ({ login: mocks.login, register: mocks.register }));
vi.mock("@/lib/auth-storage", () => ({ authStorage: { set: mocks.setToken } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

const AUTH_RESPONSE = {
  accessToken: "signed.jwt.token",
  user: {
    id: "018f0000-0000-7000-8000-000000000001",
    email: "demo@example.com",
    name: "Demo User",
    createdAt: "2026-07-01T12:00:00.000Z",
  },
};

function firstArgOf(spy: { mock: { calls: unknown[][] } }): unknown {
  return spy.mock.calls[0]?.[0];
}

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const removeQueries = vi.spyOn(queryClient, "removeQueries");
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { removeQueries, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.login.mockResolvedValue(AUTH_RESPONSE);
  mocks.register.mockResolvedValue(AUTH_RESPONSE);
});

describe("LoginForm", () => {
  it("stores the token, drops stale account queries, and enters the app", async () => {
    const { removeQueries, user } = renderWithQuery(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(firstArgOf(mocks.login)).toEqual({
        email: "demo@example.com",
        password: "password123",
      }),
    );
    await waitFor(() => expect(mocks.setToken).toHaveBeenCalledWith("signed.jwt.token"));
    expect(removeQueries).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the API message and keeps the recovery link available", async () => {
    mocks.login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    const { user } = renderWithQuery(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});

describe("RegisterForm", () => {
  it("drops client-only fields and turns a blank name into omission", async () => {
    const { user } = renderWithQuery(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(firstArgOf(mocks.register)).toEqual({
        email: "new@example.com",
        password: "password123",
        name: undefined,
      }),
    );
  });

  it("stores the registration token and links the agreement text", async () => {
    const { removeQueries, user } = renderWithQuery(<RegisterForm />);

    await user.type(screen.getByLabelText("Name"), "New User");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => expect(mocks.setToken).toHaveBeenCalledWith("signed.jwt.token"));
    expect(removeQueries).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/");
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
