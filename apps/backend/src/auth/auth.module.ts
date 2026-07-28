import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

/**
 * Authentication composition root.
 *
 * Configures Passport's JWT strategy and token signing from environment
 * settings, exposes the public auth controller, and exports `AuthService` for
 * consumers that need its token/user boundary. User storage and password work
 * remain behind the globally registered CQRS buses rather than being imported
 * from `UsersModule`.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Fails fast at boot if JWT_SECRET is missing, rather than signing
        // tokens with `undefined` and failing mysteriously later.
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          // jsonwebtoken types expiresIn as a `ms` template-literal ("7d",
          // "15m", …). An env var is an arbitrary string at compile time, so
          // the cast is unavoidable; a bad value fails loudly at first sign().
          expiresIn: config.get<string>("JWT_EXPIRES_IN", "7d") as JwtSignOptions["expiresIn"],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
