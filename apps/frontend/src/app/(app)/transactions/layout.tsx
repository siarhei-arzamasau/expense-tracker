import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page itself is a client component and cannot export `metadata`, so the
// route is named here instead. Without it the tab, the history entry and the
// screen reader's page announcement all read the root default.
export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsLayout({ children }: { children: ReactNode }) {
  return children;
}
