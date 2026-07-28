/** Shape attached to `request.user` by JwtStrategy.validate(). */
export interface AuthenticatedUser {
  id: string;
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
