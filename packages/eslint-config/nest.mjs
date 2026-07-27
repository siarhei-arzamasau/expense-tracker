import globals from "globals";

import { baseConfig } from "./base.mjs";

/**
 * Config for the NestJS backend.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nestConfig = [
  ...baseConfig,
  {
    rules: {
      // MUST stay off for NestJS. `emitDecoratorMetadata` reads constructor
      // parameter types at runtime to resolve dependencies. Rewriting
      // `import { PrismaService }` into `import type { PrismaService }` erases
      // that metadata, and the app dies at boot with
      // "Nest can't resolve dependencies of the XService".
      // The autofixer will happily make this change if the rule is on.
      "@typescript-eslint/consistent-type-imports": "off",

      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.e2e-spec.ts", "test/**/*.ts"],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default nestConfig;
