import type { Metadata } from "next";
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

/**
 * Resolves a title the way Next.js does, down a chain of layouts from the root.
 *
 * Asserting each `metadata.title` on its own is not enough, and shipping a bug
 * proved it: a segment's `title` *replaces* its parent's rather than merging
 * with it, so a plain string anywhere in the chain drops the template for every
 * route nested below. `(app)/layout.tsx` named itself "Dashboard" that way and
 * silently cost /transactions, /categories and /profile their product name
 * while every title assertion here still passed. Only composing the chain
 * catches it.
 */
function resolveTitle(chain: Metadata["title"][]): string {
  let template: string | null = null;
  let resolved = "";

  for (const title of chain) {
    if (title === undefined || title === null) continue;

    if (typeof title === "string") {
      resolved = template ? template.replace("%s", title) : title;
      // A string segment carries no template of its own, so nothing below it
      // inherits one.
      template = null;
      continue;
    }

    if ("absolute" in title && typeof title.absolute === "string") {
      resolved = title.absolute;
      template = null;
      continue;
    }

    if ("default" in title && typeof title.default === "string") {
      resolved = template ? template.replace("%s", title.default) : title.default;
    }
    template = "template" in title && typeof title.template === "string" ? title.template : null;
  }

  return resolved;
}

describe("route titles", () => {
  it("supplies a template so each route keeps the product name", () => {
    expect(rootMetadata.title).toEqual({
      default: "Expense Tracker",
      template: "%s · Expense Tracker",
    });
  });

  // `(app)/layout.tsx` is the one segment that carries the object form: it names
  // the dashboard *and* re-declares the template for the three routes nested
  // under it, so it is asserted by the composed cases below rather than here.
  it("names the dashboard and re-declares the template for the routes below it", () => {
    expect(dashboard.title).toEqual({ default: "Dashboard", template: "%s · Expense Tracker" });
  });

  it.each([
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

  it.each([
    ["/", [rootMetadata.title, dashboard.title], "Dashboard · Expense Tracker"],
    [
      "/transactions",
      [rootMetadata.title, dashboard.title, transactions.title],
      "Transactions · Expense Tracker",
    ],
    [
      "/categories",
      [rootMetadata.title, dashboard.title, categories.title],
      "Categories · Expense Tracker",
    ],
    ["/profile", [rootMetadata.title, dashboard.title, profile.title], "Profile · Expense Tracker"],
    ["/login", [rootMetadata.title, login.title], "Log in · Expense Tracker"],
    [
      "/forgot-password",
      [rootMetadata.title, forgotPassword.title],
      "Forgot password · Expense Tracker",
    ],
    [
      "/reset-password",
      [rootMetadata.title, resetPassword.title],
      "Reset password · Expense Tracker",
    ],
    ["/terms", [rootMetadata.title, terms.title], "Terms and Conditions · Expense Tracker"],
    ["/privacy", [rootMetadata.title, privacy.title], "Privacy Policy · Expense Tracker"],
  ])("keeps the product name on the rendered title for %s", (_route, chain, expected) => {
    expect(resolveTitle(chain)).toBe(expected);
  });
});
