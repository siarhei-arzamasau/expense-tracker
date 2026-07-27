import baseConfig from "@expense-tracker/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    // Generated Prisma client — not ours to lint.
    ignores: ["src/generated/**", "prisma/migrations/**"],
  },
];
