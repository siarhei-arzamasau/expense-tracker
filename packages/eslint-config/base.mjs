import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared base config for every package in the monorepo.
 * `eslintConfigPrettier` must stay last — it switches off formatting rules
 * that would otherwise fight Prettier.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { turbo: turboPlugin },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // NOTE: `@typescript-eslint/consistent-type-imports` is deliberately NOT
      // enabled here, for two independent reasons:
      //   1. It needs type-aware linting, and eslint-config-next substitutes
      //      its own parser without forwarding `parserOptions.project`, so the
      //      rule throws on every frontend file.
      //   2. Its autofix breaks NestJS. Rewriting `import { PrismaService }`
      //      into `import type` erases the emitDecoratorMetadata that DI reads
      //      at runtime, and the backend dies at boot.
      // Turning it on requires solving both, not just the one you hit first.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["dist/**", ".next/**", ".turbo/**", "node_modules/**", "src/generated/**"],
  },
  eslintConfigPrettier,
];

export default baseConfig;
