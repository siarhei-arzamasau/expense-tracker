import { MODULE_METADATA } from "@nestjs/common/constants";
import { ConfigModule } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";

import { AppModule } from "./app.module";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { UsersModule } from "./users/users.module";

type ImportedModule =
  | { module?: unknown }
  | Promise<{ module?: unknown }>
  | (abstract new (...args: never[]) => unknown);

function importsOf(module: object): ImportedModule[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as ImportedModule[];
}

describe("AppModule", () => {
  it("registers global configuration and the global CQRS runtime", async () => {
    const imports = importsOf(AppModule);
    const configImport = await Promise.resolve(imports[0]);

    expect(configImport).toMatchObject({ module: ConfigModule, global: true });
    expect(imports).toEqual(
      expect.arrayContaining([expect.objectContaining({ module: CqrsModule, global: true })]),
    );
  });

  it("composes every application feature", () => {
    expect(importsOf(AppModule)).toEqual(
      expect.arrayContaining([
        PrismaModule,
        AuthModule,
        UsersModule,
        TransactionsModule,
        CategoriesModule,
      ]),
    );
  });
});
