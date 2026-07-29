// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mocks = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/components/auth/login-form", () => ({
  LoginForm: () => <input aria-label="Login draft" />,
}));
vi.mock("@/components/auth/register-form", () => ({
  RegisterForm: () => <input aria-label="Registration draft" />,
}));

beforeEach(() => {
  mocks.search = "";
});

describe("LoginPage", () => {
  it("shows the reset-success banner from the address bar", () => {
    mocks.search = "reset=success";

    render(<LoginPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your password has been reset. Log in with your new password.",
    );
  });

  it("keeps both form drafts mounted while switching tabs", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Login draft"), "login text");
    await user.click(screen.getByRole("tab", { name: "Register" }));
    await user.type(screen.getByLabelText("Registration draft"), "register text");
    await user.click(screen.getByRole("tab", { name: "Log in" }));

    expect(screen.getByLabelText("Login draft")).toHaveValue("login text");
    expect(screen.getByLabelText("Registration draft")).toHaveValue("register text");
  });
});
