const TOKEN_KEY = "expense-tracker.token";

export const AUTH_UNAUTHORIZED_EVENT = "expense-tracker:unauthorized";

/**
 * Deliberately simple: the access token lives in localStorage.
 *
 * That makes it readable by any XSS on the page. A production app should use an
 * httpOnly + SameSite cookie set by the backend so JavaScript can never see it.
 * Kept this way here because it is far easier to inspect while learning.
 */
/**
 * The last known token, held so `get()` does not hit storage on every call.
 * `localStorage` is synchronous and `get()` is read *during render* — `AppShell`
 * consults it on every pass to decide whether there is a session at all.
 *
 * `undefined` means "not read yet" and is distinct from `null`, which means
 * "read, and there is no token". Nothing writes this on the server: `get()`
 * returns early there and the mutators below are browser-only.
 */
let cachedToken: string | null | undefined;

// Another tab logging in or out writes this key without passing through the
// mutators, so the cache has to be dropped rather than trusted. A `null` key is
// how the storage event reports a wholesale `localStorage.clear()`.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === TOKEN_KEY || event.key === null) {
      cachedToken = undefined;
    }
  });
}

export const authStorage = {
  get(): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    if (cachedToken === undefined) {
      cachedToken = window.localStorage.getItem(TOKEN_KEY);
    }
    return cachedToken;
  },

  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
    cachedToken = token;
  },

  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
    cachedToken = null;
  },

  expire(): void {
    this.clear();
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  },
};
