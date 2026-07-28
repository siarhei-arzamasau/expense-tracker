import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Provides `PrismaService` to the whole application.
 *
 * `@Global()` means a feature module injects it without importing anything,
 * which is why `TransactionsModule` has an empty `imports`. One instance is
 * shared process-wide, so there is a single connection pool rather than one per
 * consumer.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
