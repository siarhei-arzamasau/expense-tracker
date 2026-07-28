import { Module } from "@nestjs/common";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

/**
 * Wires the categories feature: its controller and service.
 *
 * `PrismaService` is available through the global `PrismaModule`, and the
 * controller's `JwtAuthGuard` resolves the passport strategy registered by
 * `AuthModule`, so neither module needs to be imported here.
 *
 * `CategoriesService` is exported so another feature can use category behavior
 * without going through HTTP. Nothing imports it today; `TransactionsService`
 * currently validates category ownership directly through Prisma.
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
