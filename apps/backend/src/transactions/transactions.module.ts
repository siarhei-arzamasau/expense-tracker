import { Module } from "@nestjs/common";

import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

/**
 * Wires the transactions feature: its controller and service.
 *
 * `PrismaService` is not imported here because `PrismaModule` is `@Global()`.
 * `JwtAuthGuard` needs no import either — it resolves the passport strategy
 * `AuthModule` registers, which is why guarded routes work without this module
 * depending on `AuthModule`.
 *
 * `TransactionsService` is exported so another feature module can read
 * transactions without going through HTTP. Nothing imports it today.
 */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
