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
      // Belt and braces: base.mjs does not enable this, but if anyone ever
      // turns it on globally it must stay off HERE. emitDecoratorMetadata reads
      // constructor parameter types at runtime to resolve dependencies, and the
      // autofix rewrites `import { PrismaService }` into `import type`, erasing
      // that metadata. The app then dies at boot with
      // "Nest can't resolve dependencies of the XService".
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
