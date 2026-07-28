import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest rather than Jest: the backend's `ts-jest` setup is pinned to the
 * CommonJS world Nest compiles into, and this package is ESM + the Next.js
 * `@/*` path alias.
 *
 * Scope is deliberately narrow — `environment: "node"` and `src/lib` only.
 * These are the pure functions that parse untrusted URL input and build request
 * URLs; testing them needs no DOM. Component tests would mean jsdom and a
 * testing-library stack, which is a separate decision.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
