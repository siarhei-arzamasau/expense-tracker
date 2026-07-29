import { MODULE_METADATA } from "@nestjs/common/constants";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { AuthModule } from "./auth.module";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

describe("AuthModule", () => {
  it("registers Passport and JWT without importing the users implementation", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as Array<{
      module?: unknown;
      imports?: unknown[];
    }>;

    expect(imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: PassportModule }),
        expect.objectContaining({ module: JwtModule, imports: [ConfigModule] }),
      ]),
    );
  });

  it("exposes the auth boundary and keeps its controller and strategy wired", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule)).toEqual([AuthController]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule)).toEqual([
      AuthService,
      JwtStrategy,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule)).toEqual([AuthService]);
  });
});
