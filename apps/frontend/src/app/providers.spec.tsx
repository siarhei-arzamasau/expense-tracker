// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-storage";
import { Providers } from "./providers";

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  replace: vi.fn(),
  queryClient: { clear: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClient: function MockQueryClient() {
    return mocks.queryClient;
  },
  QueryClientProvider: function MockQueryClientProvider({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return children;
  },
}));

describe("Providers", () => {
  let locationDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    locationDescriptor = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { replace: mocks.replace },
    });
  });

  afterEach(() => {
    if (locationDescriptor) Object.defineProperty(window, "location", locationDescriptor);
  });

  it("clears cached account data and hard-navigates after involuntary expiry", () => {
    render(
      <Providers>
        <span>Account</span>
      </Providers>,
    );

    act(() => window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT)));

    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(mocks.queryClient.clear).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it("removes the global listener when the provider unmounts", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Providers>Account</Providers>);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(AUTH_UNAUTHORIZED_EVENT, expect.any(Function));
  });
});
