import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedUser } from "../types";

/**
 * Parameter decorator that pulls the user `JwtStrategy.validate()` attached to
 * the request.
 *
 * Only meaningful on routes guarded by `JwtAuthGuard`. It performs no check of
 * its own: on an unguarded route `request.user` is absent and the parameter
 * arrives as `undefined` rather than throwing, so reading `user.id` there fails
 * at runtime with a type that claimed it could not. Guard the route.
 *
 * @param _data - Unused; the decorator takes no argument. Present because
 * `createParamDecorator` always passes one.
 * @param context - Execution context Nest supplies, narrowed to HTTP.
 * @returns The authenticated user's id and email.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
