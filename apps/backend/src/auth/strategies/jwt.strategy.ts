import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { AuthenticatedUser, JwtPayload } from "../types";

/**
 * Passport strategy behind `JwtAuthGuard`, registered under the name `"jwt"`.
 *
 * Verifies the bearer token's signature and expiry; passport itself answers 401
 * when either fails, so `validate` below only ever sees a token this server
 * signed and that has not expired.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  /**
   * Configures token extraction and verification.
   *
   * @param config - Nest config service; supplies `JWT_SECRET`.
   * @throws {Error} `JWT_SECRET` is not set — thrown at boot, so the server
   * cannot start in a state where it would verify tokens against `undefined`.
   */
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  /**
   * Turns verified claims into the object handlers receive.
   *
   * Return value is attached to `request.user`. No database lookup happens
   * here, so a token naming a since-deleted user still authenticates — the
   * route that cares (`GET /auth/me`) is what answers 401 for it.
   *
   * @param payload - Verified JWT claims; `sub` is the user id.
   * @returns The authenticated user, as every guarded handler sees it.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}
