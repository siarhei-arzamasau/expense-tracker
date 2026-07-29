import type { Metadata } from "next";
import { Manrope, Outfit } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

/**
 * Two faces, two jobs. Outfit is geometric and wide — it carries the wordmark,
 * the page titles and every money figure, which is where the app should look
 * confident. Manrope is narrower and more utilitarian, so it runs the interface
 * text: labels, tables, forms, buttons. Both are exposed as CSS variables and
 * bound to `--font-display` / `--font-sans` in `globals.css`.
 */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Track where the money goes",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${manrope.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
