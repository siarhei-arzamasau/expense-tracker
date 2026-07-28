const TOKEN_KEY = "expense-tracker.token";

export const AUTH_UNAUTHORIZED_EVENT = "expense-tracker:unauthorized";

/**
 * Deliberately simple: the access token lives in localStorage.
 *
 * That makes it readable by any XSS on the page. A production app should use an
 * httpOnly + SameSite cookie set by the backend so JavaScript can never see it.
 * Kept this way here because it is far easier to inspect while learning.
 */
export const authStorage = {
  get(): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(TOKEN_KEY);
  },

  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  },

  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
  },

  expire(): void {
    this.clear();
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  },
};
