// Prisma 7 no longer auto-loads .env files. Without the dotenv call below,
// every `prisma` command fails with:
//   "Environment variable not found: DATABASE_URL"
//
// A bare `import "dotenv/config"` is NOT enough here: it reads `.env` relative
// to process.cwd(), which is packages/database when the Prisma CLI runs, while
// the .env this monorepo actually uses lives at the repo root.
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// First match wins per key; a package-local .env can still override nothing
// that the root already set. Missing files are ignored, not fatal.
for (const candidate of ["../../.env", ".env"]) {
  loadEnv({ path: resolve(process.cwd(), candidate), override: false, quiet: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Connection URLs live here in v7, not in schema.prisma.
    url: env("DATABASE_URL"),
  },
});
