import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuthResponse, UserDto } from "@expense-tracker/shared";

import { errorSchema } from "../common/swagger/error-schema";
import { USER_SCHEMA } from "../users/user.schema";
import { AUTH_RESPONSE_SCHEMA } from "./auth.schema";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
// Value imports, not `import type`: the ValidationPipe needs the actual class
// at runtime, which it gets from emitDecoratorMetadata on the @Body() param.
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthenticatedUser } from "./types";

/**
 * Public authentication endpoints plus the guarded current-user lookup.
 *
 * Registration, login, and password recovery deliberately have no class-level
 * guard: callers cannot be expected to hold a token yet. Only `GET /auth/me`
 * installs `JwtAuthGuard`, so its bearer requirement and 401 response are
 * documented on that method rather than inherited by the public routes.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * `POST /api/auth/register` — creates an account and signs its first JWT.
   *
   * @param dto - Email, password, and optional display name, validated by the global pipe.
   * @returns 201 with the new public user and an access token.
   * @throws {BadRequestException} 400 — the body fails validation or has an unknown field.
   * @throws {ConflictException} 409 — an account already uses the email.
   */
  @Post("register")
  @ApiOperation({
    summary: "Create an account and return an access token",
    description:
      "Registers a user with a unique email, then immediately signs a bearer token for that account. The password is accepted only in the request and never appears in the response.",
  })
  @ApiCreatedResponse({
    description: "The new user and a signed access token",
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiBadRequestResponse({
    description: "The body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, ["Password must be at least 8 characters"]),
  })
  @ApiConflictResponse({
    description: "An account already uses this email",
    schema: errorSchema(HttpStatus.CONFLICT, "An account with that email already exists"),
  })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * `POST /api/auth/login` — verifies credentials and signs a JWT.
   *
   * @param dto - Email and password, validated by the global pipe.
   * @returns 200 with the public user and an access token.
   * @throws {BadRequestException} 400 — the body fails validation or has an unknown field.
   * @throws {UnauthorizedException} 401 — the email or password is wrong.
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Exchange credentials for an access token",
    description:
      "Verifies the email and password and returns the same response shape as registration. Unknown emails and incorrect passwords deliberately share one 401 response.",
  })
  @ApiOkResponse({
    description: "The authenticated user and a signed access token",
    schema: AUTH_RESPONSE_SCHEMA,
  })
  @ApiBadRequestResponse({
    description: "The body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, ["email must be an email"]),
  })
  @ApiUnauthorizedResponse({
    description: "The email is unknown or the password is incorrect",
    schema: errorSchema(HttpStatus.UNAUTHORIZED, "Invalid email or password"),
  })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * `GET /api/auth/me` — resolves the bearer token's current user record.
   *
   * @param user - Token claims attached by `JwtStrategy` after authentication.
   * @returns 200 with the current public user.
   * @throws {UnauthorizedException} 401 — the token is absent or invalid, or
   * names a user that has since been deleted.
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Return the currently authenticated user",
    description:
      "Authenticates the bearer token, then reads the user again so a valid token for a deleted account still answers 401 rather than returning stale claims.",
  })
  @ApiOkResponse({ description: "The current public user", schema: USER_SCHEMA })
  @ApiUnauthorizedResponse({
    description: "Missing, malformed, expired token, or a token whose user no longer exists",
    schema: errorSchema(HttpStatus.UNAUTHORIZED, "Unauthorized"),
  })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.authService.findById(user.id);
  }

  // No JwtAuthGuard on either endpoint below — the caller is not
  // authenticated by definition.

  /**
   * `POST /api/auth/forgot-password` — starts password recovery without
   * revealing whether the email exists.
   *
   * @param dto - Email address to look up.
   * @returns 204 with no body for both known and unknown emails.
   * @throws {BadRequestException} 400 — the body fails validation or has an unknown field.
   */
  @Post("forgot-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Request a password reset link (logged, not emailed, in this template)",
    description:
      "Always returns 204 for a valid email-shaped request, whether or not an account exists. In this learning template the reset URL is logged instead of delivered by email.",
  })
  @ApiNoContentResponse({
    description: "Request accepted; no account-existence information is returned",
  })
  @ApiBadRequestResponse({
    description: "The body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, ["email must be an email"]),
  })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.authService.requestPasswordReset(dto);
  }

  /**
   * `POST /api/auth/reset-password` — replaces the password named by a
   * single-use reset token.
   *
   * @param dto - Reset token and validated replacement password.
   * @returns 204 with no body after the password is changed and token consumed.
   * @throws {BadRequestException} 400 — validation fails, or the token is unknown,
   * expired, or already used.
   */
  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Reset a password using a token from the reset link",
    description:
      "Consumes a 43-character, single-use reset token and stores the replacement password. Unknown, expired, and already-used tokens deliberately share one 400 response.",
  })
  @ApiNoContentResponse({ description: "Password changed and reset token consumed" })
  @ApiBadRequestResponse({
    description: "The body is invalid, or the token is unknown, expired, or already used",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Reset link is invalid or has expired"),
  })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }
}
