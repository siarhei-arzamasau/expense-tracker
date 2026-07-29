import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import ProtectedLayout from "./layout";

describe("ProtectedLayout", () => {
  it("places every authenticated page inside AppShell", () => {
    const layout = ProtectedLayout({ children: "Private page" });

    expect(layout.type).toBe(AppShell);
    expect(layout.props.children).toBe("Private page");
  });
});
