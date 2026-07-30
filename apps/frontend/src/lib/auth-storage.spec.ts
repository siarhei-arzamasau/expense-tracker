// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_UNAUTHORIZED_EVENT, authStorage } from "./auth-storage";

/** What a second tab would write. The module keeps this private. */
const TOKEN_KEY = "expense-tracker.token";

beforeEach(() => {
  // Through `clear()` rather than `localStorage.clear()`: the token is cached in
  // module scope, and emptying storage behind the module's back would leave the
  // next test reading a token this one thought it had removed.
  authStorage.clear();
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

  // `get()` is read during render, so it holds the token in memory rather than
  // touching synchronous storage on every pass. That cache is only correct if
  // something invalidates it when a write bypasses the mutators, which is
  // exactly what a second tab does.
  it("drops the cached token when another tab writes the key", () => {
    authStorage.set("access-token");
    expect(authStorage.get()).toBe("access-token");

    window.localStorage.setItem(TOKEN_KEY, "rotated-token");
    window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY }));

    expect(authStorage.get()).toBe("rotated-token");
  });

  it("drops the cached token when another tab clears all storage", () => {
    authStorage.set("access-token");
    expect(authStorage.get()).toBe("access-token");

    window.localStorage.clear();
    // A null key is how the storage event reports a wholesale clear().
    window.dispatchEvent(new StorageEvent("storage", { key: null }));

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
