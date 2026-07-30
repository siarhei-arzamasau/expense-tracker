import { resolve } from "node:path";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { UsersModule } from "./users/users.module";

/**
 * Root composition for the HTTP application.
 *
 * Configuration and CQRS are global infrastructure; feature modules own their
 * controllers and providers. `PrismaModule` supplies one global client and
 * connection pool to every persistence consumer.
 *
 * The filter and interceptor are registered here, through `APP_FILTER` and
 * `APP_INTERCEPTOR`, rather than with `useGlobalFilters`/`useGlobalInterceptors`
 * in `main.ts`. Being part of the module graph means every bootstrap gets them —
 * including `test/app.e2e-spec.ts`, which is exactly the divergence that
 * `configure-app.ts` exists to prevent for the `ValidationPipe`. It also lets
 * Nest inject what they need, which `PrismaExceptionFilter` depends on.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // ConfigModule resolves relative paths against process.cwd(), which is
      // NOT stable here: `turbo dev` runs with cwd=apps/backend while
      // `pnpm --filter @expense-tracker/backend start:prod` from the repo root
      // runs with cwd=<root>. A bare "../../.env" is right in one and escapes
      // the repo in the other, so anchor to __dirname (apps/backend/dist) and
      // keep a cwd-relative entry as a fallback. First file to define a key wins.
      envFilePath: [resolve(__dirname, "../../../.env"), resolve(process.cwd(), ".env")],
    }),
    // forRoot() and not a bare `CqrsModule`: only the dynamic form is marked
    // global, so this is what puts CommandBus and QueryBus in reach of every
    // module without each one importing CQRS. Mixing the two forms surfaces as
    // "Nest can't resolve CommandBus" at boot.
    CqrsModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    CategoriesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
