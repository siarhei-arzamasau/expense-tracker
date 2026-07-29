// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  token: "access-token" as string | null,
  pathname: "/transactions",
  replace: vi.fn(),
  logout: vi.fn(),
  refetch: vi.fn(),
  queryOptions: undefined as unknown,
  queryResult: {} as {
    data?: { id: string; email: string; name: string | null; createdAt: string };
    error: Error | null;
    isPending: boolean;
    refetch: () => unknown;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => {
    mocks.queryOptions = options;
    return mocks.queryResult;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/auth-storage", () => ({ authStorage: { get: () => mocks.token } }));
vi.mock("@/lib/queries/user", () => ({ currentUserQueryOptions: { queryKey: ["current-user"] } }));
vi.mock("@/lib/use-logout", () => ({ useLogout: () => mocks.logout }));

const USER = {
  id: "018f0000-0000-7000-8000-000000000001",
  email: "demo@example.com",
  name: "😀 Sergey",
  createdAt: "2026-07-01T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "access-token";
  mocks.pathname = "/transactions";
  mocks.queryOptions = undefined;
  mocks.queryResult = { data: USER, error: null, isPending: false, refetch: mocks.refetch };
});

describe("AppShell", () => {
  it("owns the no-token redirect and keeps private content hidden while it runs", async () => {
    mocks.token = null;
    mocks.queryResult = { data: undefined, error: null, isPending: false, refetch: mocks.refetch };

    render(<AppShell>Private content</AppShell>);

    expect(screen.getByText("Loading your workspace…")).toBeInTheDocument();
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  });

  it("disables the current-user query when no token exists", () => {
    mocks.token = null;
    mocks.queryResult = { data: undefined, error: null, isPending: false, refetch: mocks.refetch };

    render(<AppShell>Private content</AppShell>);

    expect(mocks.queryOptions).toEqual(expect.objectContaining({ enabled: false }));
  });

  it("shows the loading state while the current account is pending", () => {
    mocks.queryResult = { data: undefined, error: null, isPending: true, refetch: mocks.refetch };

    render(<AppShell>Private content</AppShell>);

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("lets the global expiry handler own an unauthorized query failure", () => {
    mocks.queryResult = {
      data: undefined,
      error: new ApiError(401, "Unauthorized"),
      isPending: false,
      refetch: mocks.refetch,
    };

    const { container } = render(<AppShell>Private content</AppShell>);

    expect(container).toBeEmptyDOMElement();
  });

  it("offers a retry for an ordinary account-loading failure", async () => {
    const user = userEvent.setup();
    mocks.queryResult = {
      data: undefined,
      error: new ApiError(503, "Service unavailable"),
      isPending: false,
      refetch: mocks.refetch,
    };

    render(<AppShell>Private content</AppShell>);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Service unavailable")).toBeInTheDocument();
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  // Both halves matter and neither is visible to a type check: a skip link that
  // is not first saves no keystrokes, and one pointing at a container without
  // `tabIndex` scrolls the page while leaving focus back in the navigation, so
  // the next Tab returns to the links the reader just skipped.
  it("puts the skip link ahead of the navigation and targets a focusable wrapper", () => {
    render(<AppShell>Private content</AppShell>);

    const skip = screen.getByRole("link", { name: "Skip to main content" });
    const firstNavLink = screen.getByRole("link", { name: "Dashboard" });
    const target = document.getElementById("main-content");

    expect(
      skip.compareDocumentPosition(firstNavLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(target).toHaveAttribute("tabindex", "-1");
    expect(target).toContainElement(screen.getByText("Private content"));
  });

  it("marks the active route, preserves emoji initials, and exposes voluntary logout", async () => {
    const user = userEvent.setup();
    render(<AppShell>Private content</AppShell>);

    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("😀S")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
});
