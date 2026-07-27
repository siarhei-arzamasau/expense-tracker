import { resolve } from "node:path";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { PrismaModule } from "./prisma/prisma.module";

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
    PrismaModule,
    AuthModule,
    ExpensesModule,
    CategoriesModule,
  ],
})
export class AppModule {}
