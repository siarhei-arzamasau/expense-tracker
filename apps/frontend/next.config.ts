import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @expense-tracker/shared ships compiled CJS from the workspace; letting Next
  // transpile it keeps source maps and tree shaking working across the boundary.
  transpilePackages: ["@expense-tracker/shared"],
};

export default nextConfig;
