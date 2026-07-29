import { describe, expect, it } from "vitest";

import RootLayout, { metadata } from "./layout";
import { Providers } from "./providers";

describe("RootLayout", () => {
  it("sets the document language and wraps page content in Providers", () => {
    const layout = RootLayout({ children: "Page content" });
    const body = layout.props.children;
    const providers = body.props.children;

    expect(layout.type).toBe("html");
    expect(layout.props.lang).toBe("en");
    expect(body.type).toBe("body");
    expect(providers.type).toBe(Providers);
    expect(providers.props.children).toBe("Page content");
  });

  it("exports the application title and description", () => {
    expect(metadata).toMatchObject({
      title: "Expense Tracker",
      description: "Track where the money goes",
    });
  });
});
