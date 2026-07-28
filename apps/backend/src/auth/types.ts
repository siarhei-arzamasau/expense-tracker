/**
 * Shape attached to `request.user` by JwtStrategy.validate(), and what the
 * `@CurrentUser()` decorator hands to a guarded handler.
 *
 * Derived from the token alone — no row is read to build it, so its presence
 * proves the token was valid, not that the user still exists.
 */
export interface AuthenticatedUser {
  /** User id, from the token's `sub`. The value every query scopes by. */
  id: string;
  /** Convenience copy of the claim; may be stale. Never authorise on it. */
  email: string;
}

/**
 * Claims we put into, and read out of, the signed JWT.
 *
 * `email` goes stale after PATCH /users/me changes it, and stays stale until
 * the token expires. That is harmless because nothing authorises on it —
 * every query and mutation scopes by `sub` — but do not start trusting it.
 */
export interface JwtPayload {
  sub: string;
  email: string;
}
