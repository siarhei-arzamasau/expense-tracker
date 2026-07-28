import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

/**
 * Prisma 7 removed the built-in connection path. `new PrismaClient()` with no
 * options now throws:
 *
 *   PrismaClientInitializationError: PrismaClient was instantiated without any
 *   options. A driver adapter is required to connect to your database.
 *
 * Everything that needs a client goes through here so the adapter is wired in
 * exactly one place.
 */
export function createPgAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({ connectionString });
}

export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env at the repo root");
  }
  return new PrismaClient({ adapter: createPgAdapter(connectionString) });
}
