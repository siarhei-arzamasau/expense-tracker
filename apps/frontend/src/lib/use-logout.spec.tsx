// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLogout } from "./use-logout";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), clearToken: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("./auth-storage", () => ({ authStorage: { clear: mocks.clearToken } }));

beforeEach(() => vi.clearAllMocks());

describe("useLogout", () => {
  it("clears the token and cached account data before navigating client-side", () => {
    const queryClient = new QueryClient();
    const clearCache = vi.spyOn(queryClient, "clear");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current();

    expect(mocks.clearToken).toHaveBeenCalledTimes(1);
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });
});
