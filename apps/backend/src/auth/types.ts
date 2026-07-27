/** Shape attached to `request.user` by JwtStrategy.validate(). */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Claims we put into, and read out of, the signed JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
}
