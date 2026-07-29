import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * React Testing Library only auto-cleans when Vitest runs with `globals: true`,
 * and this project keeps globals off so every spec imports what it uses. Without
 * this hook each render would stack another copy of the component in the same
 * document and `getBy*` would start throwing "found multiple elements".
 *
 * Harmless for the `src/lib` specs: they run in `environment: "node"`, never
 * render anything, and cleanup on an empty container is a no-op.
 */
afterEach(() => {
  cleanup();
});
