import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPgAdapter, PrismaClient } from "@expense-tracker/database";

/**
 * The `PrismaClient` as a Nest provider, with its connection tied to the
 * application lifecycle.
 *
 * Injected directly by `TransactionsService` and `CategoriesService`; the users
 * module reaches the database through its repositories instead. It extends the
 * client rather than wrapping it, so every model accessor (`prisma.transaction`,
 * `prisma.$transaction`, …) is available unchanged.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Builds the client against a pg driver adapter.
   *
   * Prisma 7 requires a driver adapter — `super()` with no options throws.
   *
   * @param config - Nest config service; supplies `DATABASE_URL`.
   * @throws {Error} `DATABASE_URL` is not set. `getOrThrow` fires while the DI
   * container is being built, so the process dies at boot instead of at the
   * first query.
   */
  constructor(config: ConfigService) {
    super({ adapter: createPgAdapter(config.getOrThrow<string>("DATABASE_URL")) });
  }

  /**
   * Opens the connection pool once the module is initialised.
   *
   * @returns A promise settling when the pool is ready.
   * @throws {Error} Postgres is unreachable or rejects the credentials; Nest
   * aborts the bootstrap rather than serving requests that would all fail.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Closes the connection pool on shutdown.
   *
   * @returns A promise settling when the pool is closed.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
