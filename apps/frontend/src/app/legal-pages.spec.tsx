// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";

describe("legal placeholder pages", () => {
  it.each([
    ["Terms and Conditions", TermsPage, termsMetadata],
    ["Privacy Policy", PrivacyPage, privacyMetadata],
  ])("renders the %s placeholder with a route back to login", (title, Page, metadata) => {
    render(<Page />);

    expect(screen.getByText(title)).toHaveAttribute("data-slot", "card-title");
    expect(metadata).toEqual({ title });
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });
});
