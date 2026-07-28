# Migrate from Prettier/ESLint to Oxfmt/Oxlint

## Summary

Replace Prettier and ESLint completely as the project's formatter and lint engine while preserving existing commands, formatting output, rule intent, package-scoped linting, and pre-commit behavior. Use Oxfmt `^0.60.0` and Oxlint `^1.76.0`, following the official [Prettier migration](https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier.html) and [ESLint migration](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) guidance.

## Implementation Changes

- Replace direct Prettier/ESLint dependencies with Oxfmt/Oxlint:
  - Add Oxfmt at the workspace root.
  - Replace each package's direct `eslint` dependency with `oxlint` so filtered `lint` scripts remain self-contained.
  - Keep `eslint-plugin-turbo` at the root and load it through Oxlint's JavaScript-plugin bridge to preserve `turbo/no-undeclared-env-vars`.
  - Remove `eslint-config-next`, `@expense-tracker/eslint-config`, and the entire `packages/eslint-config` workspace package.
  - Regenerate `pnpm-lock.yaml`; ESLint may remain only as a transitive peer of the Turbo bridge, never as a direct dependency or executable.

- Create one root `oxlint.config.ts`:
  - Use native `eslint`, `typescript`, `react`, `nextjs`, `import`, `jsx-a11y`, and `jest` plugins.
  - Convert active rules and severities from the effective ESLint configurations, using `@oxlint/migrate` output as a migration aid.
  - Preserve `no-console`, unused-variable patterns, backend `no-explicit-any`, Jest globals, generated Prisma/migration ignores, and frontend browser/Next.js settings.
  - Keep type-aware linting disabled.
  - Preserve `turbo/no-undeclared-env-vars` as a warning through `{ name: "turbo", specifier: "eslint-plugin-turbo" }`; Oxlint documents this bridge as alpha. [Oxlint plugin documentation](https://oxc.rs/docs/guide/usage/linter/config-file-reference.html#jsplugins)
  - Map React Hooks rules to native `react/rules-of-hooks` and `react/exhaustive-deps`. Replace the individual React Compiler diagnostics with `react/react-compiler` at error severity—the closest native equivalent, though two diagnostics previously configured as warnings become errors. [React Compiler rule](https://oxc.rs/docs/guide/usage/linter/rules/react/react-compiler.html)
  - Keep `consistent-type-imports` disabled for NestJS files to protect decorator metadata and dependency injection.
  - Remove all `eslint.config.mjs` files and convert the seed's `eslint-disable` comment to an Oxlint directive.

- Create `.oxfmtrc.jsonc` and remove `.prettierrc`/`.prettierignore`:
  - Preserve `semi`, double quotes, trailing commas, 100-column width, two-space indentation, arrow parentheses, and LF endings.
  - Move all current ignore entries into `ignorePatterns`.
  - Explicitly disable `sortImports`, `sortTailwindcss`, and `sortPackageJson`; package sorting is otherwise enabled by default. [Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html)
  - Run Oxfmt once across the repository and commit only unavoidable compatibility formatting changes.

- Preserve developer workflows:
  - Keep `pnpm lint` routed through Turbo; change package scripts from `eslint .` to `oxlint .`.
  - Change root scripts to `format: "oxfmt"` and `format:check: "oxfmt --check"`.
  - Add `lint:fix: "oxlint --fix ."` for manual safe fixes.
  - Update lint-staged to run Oxfmt followed by `oxlint --fix --no-error-on-unmatched-pattern` for JS/TS files; retain Prisma's own formatter for `.prisma`.
  - Do not enable dangerous Oxlint fixes.
  - Update README and CLAUDE.md: commands, repository layout, removed ESLint version constraints, the Turbo bridge caveat, and the NestJS type-import safeguard.

## Test Plan

- Verify formatting stability:
  - Run `pnpm format`, review the resulting diff, then run `pnpm format:check`.
  - Confirm package.json fields, imports, and Tailwind classes were not reordered.

- Verify lint parity:
  - Run root and package-scoped lint commands.
  - Confirm unused variables, forbidden console calls, Next.js `<img>` usage, invalid hooks, and undeclared Turbo environment variables are reported.
  - Confirm declared environment variables and Jest globals pass.
  - Confirm backend specs still allow `any` and NestJS runtime imports are not rewritten to type-only imports.

- Run the complete project gate:
  - `pnpm db:generate`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
  - `pnpm build`
  - `git diff --check`

- Search for stale integrations. No Prettier or ESLint scripts, configs, direct dependencies, or disable comments should remain; intentional references to `eslint-plugin-turbo` and its documented Oxlint bridge are allowed.

## Assumptions

- This is a direct cutover, not a dual-linter transition.
- Existing rule behavior takes priority over adopting Oxlint defaults, nursery rules, or type-aware analysis.
- Formatting compatibility takes priority over Oxfmt's sorting features.
- No application APIs, database schema, or runtime behavior change.
