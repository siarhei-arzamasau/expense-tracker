import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest rather than Jest: the backend's `ts-jest` setup is pinned to the
 * CommonJS world Nest compiles into, and this package is ESM + the Next.js
 * `@/*` path alias.
 *
 * Two kinds of spec live here. `src/lib/**` holds pure functions — the ones
 * that parse untrusted URL input and build request URLs — and they stay on the
 * default `environment: "node"` because they never touch a DOM. Component specs
 * opt into jsdom per file with a `@vitest-environment jsdom` docblock, which
 * keeps the pure specs off a DOM they do not need. Forgetting the docblock
 * fails loudly with `document is not defined`; it does not silently skip.
 *
 * The `oxc.jsx` block is not optional. Vite 8 transforms with oxc and reads
 * `jsx` from the Next.js tsconfig, where it is `"preserve"` — so without this
 * every `.spec.tsx` dies in import analysis with "content contains invalid JS
 * syntax ... make sure to not set jsx to preserve". It belongs under `oxc`
 * rather than `esbuild`: setting both makes Vite announce that it is ignoring
 * the esbuild half.
 *
 * `next/font/google` is aliased for the same class of reason: it is a compiler
 * transform, not a runtime module, and importing it outside a Next build throws
 * "next/font requires SWC". `vitest.next-font.ts` returns the shape the root
 * layout consumes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "next/font/google": fileURLToPath(new URL("./vitest.next-font.ts", import.meta.url)),
    },
  },
});
