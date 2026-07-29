/**
 * Stand-in for `next/font/google` under Vitest.
 *
 * The real module is not importable outside a Next.js build: font loading is a
 * compiler transform, and calling `Outfit()` under any other bundler throws
 * "next/font requires SWC". `vitest.config.ts` aliases the specifier here so
 * `app/layout.spec.tsx` can render the root layout at all. The shape returned
 * is the part of the loader's result the app uses — nothing asserts on the
 * class names, only that the layout renders.
 */
interface FontResult {
  className: string;
  variable: string;
  style: { fontFamily: string };
}

function stubFont(name: string) {
  return (options: { variable?: string } = {}): FontResult => ({
    className: `__stub_${name}`,
    variable: options.variable ?? `--font-${name}`,
    style: { fontFamily: name },
  });
}

export const Outfit = stubFont("outfit");
export const Manrope = stubFont("manrope");
