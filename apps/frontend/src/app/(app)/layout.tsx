import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

// Titles the dashboard at `/`, which has no layout of its own to name it. The
// other three protected routes override this from their own `layout.tsx`.
//
// The `template` has to be restated here, and that is the whole point of the
// object form. A segment's `title` replaces its parent's for everything below
// it, and a plain string carries no template — so `title: "Dashboard"` named
// this route correctly while silently stripping `· Expense Tracker` from
// /transactions, /categories and /profile, the three routes nested under it.
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Expense Tracker" },
};

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
