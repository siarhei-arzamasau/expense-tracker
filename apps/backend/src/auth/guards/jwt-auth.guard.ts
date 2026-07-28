import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Requires a valid bearer token on the routes it guards.
 *
 * Delegates entirely to the passport strategy registered under the name `"jwt"`
 * (`JwtStrategy`), which is why this class is empty and why it needs no import
 * from the module that uses it — passport resolves the strategy by name at
 * request time.
 *
 * On success it attaches `JwtStrategy.validate()`'s return value to
 * `request.user`, where the `CurrentUser` decorator reads it. On failure it throws
 * `UnauthorizedException` (401) before the handler is entered — covering a
 * missing header, a malformed token, a bad signature, and an expired one alike,
 * with no detail about which. The frontend clears its stored token on 401 and
 * on nothing else, so widening what this answers has consequences there.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
