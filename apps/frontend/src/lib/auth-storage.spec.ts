// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_UNAUTHORIZED_EVENT, authStorage } from "./auth-storage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("authStorage", () => {
  it("returns null when rendered without a browser window", () => {
    vi.stubGlobal("window", undefined);

    expect(authStorage.get()).toBeNull();

    vi.unstubAllGlobals();
  });

  it("stores, reads, and clears the access token", () => {
    authStorage.set("access-token");
    expect(authStorage.get()).toBe("access-token");

    authStorage.clear();
    expect(authStorage.get()).toBeNull();
  });

  it("clears the token before announcing involuntary expiry", () => {
    authStorage.set("access-token");
    const listener = vi.fn(() => expect(authStorage.get()).toBeNull());
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);

    authStorage.expire();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });
});
