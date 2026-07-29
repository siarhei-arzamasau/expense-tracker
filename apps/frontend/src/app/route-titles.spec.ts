import { describe, expect, it, vi } from "vitest";

/**
 * Seven of the nine routes are client components, and a client component cannot
 * export `metadata` — so each is named from a sibling `layout.tsx` instead, and
 * the root layout supplies the `%s · Expense Tracker` template that completes
 * them. Deleting one of those layouts breaks nothing loudly: the route falls
 * back to the root default and its tab, its history entry and its screen reader
 * page announcement all silently read "Expense Tracker", the same as every
 * other route. That is the regression this file exists to catch.
 *
 * `/terms` and `/privacy` are server components and carry their own `metadata`,
 * so they are asserted from the page module rather than from a layout.
 */
vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => null }));

import { metadata as rootMetadata } from "./layout";
import { metadata as dashboard } from "./(app)/layout";
import { metadata as transactions } from "./(app)/transactions/layout";
import { metadata as categories } from "./(app)/categories/layout";
import { metadata as profile } from "./(app)/profile/layout";
import { metadata as login } from "./login/layout";
import { metadata as forgotPassword } from "./forgot-password/layout";
import { metadata as resetPassword } from "./reset-password/layout";
import { metadata as terms } from "./terms/page";
import { metadata as privacy } from "./privacy/page";

describe("route titles", () => {
  it("supplies a template so each route keeps the product name", () => {
    expect(rootMetadata.title).toEqual({
      default: "Expense Tracker",
      template: "%s · Expense Tracker",
    });
  });

  it.each([
    ["the dashboard", dashboard, "Dashboard"],
    ["transactions", transactions, "Transactions"],
    ["categories", categories, "Categories"],
    ["profile", profile, "Profile"],
    ["login", login, "Log in"],
    ["forgot password", forgotPassword, "Forgot password"],
    ["reset password", resetPassword, "Reset password"],
    ["terms", terms, "Terms and Conditions"],
    ["privacy", privacy, "Privacy Policy"],
  ])("names %s distinctly from the root default", (_label, metadata, title) => {
    expect(metadata.title).toBe(title);
    expect(metadata.title).not.toBe("Expense Tracker");
  });
});
