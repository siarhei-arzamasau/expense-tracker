import baseConfig from "@expense-tracker/eslint-config/base";
import next from "eslint-config-next";

// eslint-config-next has shipped both shapes across versions; normalize so this
// works whether the default export is a flat-config array or a single object.
const nextConfig = Array.isArray(next) ? next : [next];

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...baseConfig,
  ...nextConfig,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];

export default config;
