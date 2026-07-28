/**
 * Route segments shared by the Nest controllers and the frontend fetch client,
 * so a rename on one side is a type error on the other.
 *
 * These are paths *below* the global `api` prefix that `main.ts` sets — the
 * frontend's NEXT_PUBLIC_API_URL already includes it (http://localhost:3001/api).
 */
export const API_ROUTES = {
  auth: {
    root: "auth",
    register: "auth/register",
    login: "auth/login",
    me: "auth/me",
    forgotPassword: "auth/forgot-password",
    resetPassword: "auth/reset-password",
  },
  users: {
    // Account management for the caller's own user. Reading the profile stays
    // on auth/me — there is no GET users/me duplicating it.
    me: "users/me",
    password: "users/me/password",
  },
  transactions: {
    root: "transactions",
    summary: "transactions/summary",
    byId: (id: string) => `transactions/${id}`,
  },
  categories: {
    root: "categories",
    byId: (id: string) => `categories/${id}`,
  },
} as const;
