import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

// Titles the dashboard at `/`, which has no layout of its own to name it. The
// other three protected routes override this from their own `layout.tsx`.
export const metadata: Metadata = { title: "Dashboard" };

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
