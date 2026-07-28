import { resolve } from "node:path";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { UsersModule } from "./users/users.module";

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
})
export class AppModule {}
