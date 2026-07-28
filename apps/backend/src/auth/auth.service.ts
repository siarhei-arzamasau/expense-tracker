import { Injectable, UnauthorizedException } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { JwtService } from "@nestjs/jwt";
import type { AuthResponse, UserDto } from "@expense-tracker/shared";

import { RegisterUserCommand } from "../users/commands/register-user.command";
import { RequestPasswordResetCommand } from "../users/commands/request-password-reset.command";
import { ResetUserPasswordCommand } from "../users/commands/reset-user-password.command";
import { GetUserByIdQuery } from "../users/queries/get-user-by-id.query";
import { VerifyUserCredentialsQuery } from "../users/queries/verify-user-credentials.query";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { JwtPayload } from "./types";

/**
 * Owns tokens, and nothing else.
 *
 * Everything about the user — storage, hashing, uniqueness — reaches this class
 * through the buses. There is no PrismaService and no argon2 here, and no
 * import of UsersService: the command and query classes are the whole contract.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // The handler raises ConflictException if the email is taken.
    const user = await this.commandBus.execute(
      new RegisterUserCommand(dto.email, dto.password, dto.name),
    );

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.queryBus.execute(
      new VerifyUserCredentialsQuery(dto.email, dto.password),
    );

    // One message for both an unknown email and a bad password, so the response
    // does not reveal which emails are registered.
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Backs GET /auth/me. A token naming a user who no longer exists — deleted
   * via DELETE /users/me, since tokens are not revoked — has to come back 401,
   * not 404: the frontend clears its stored token on 401 and nothing else.
   */
  async findById(id: string): Promise<UserDto> {
    const user = await this.queryBus.execute(new GetUserByIdQuery(id));
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  /**
   * Resolves the same way for a known and an unknown email — the handler
   * decides what to do with the difference, and it must not reach here.
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    await this.commandBus.execute(new RequestPasswordResetCommand(dto.email));
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    // The handler raises BadRequestException for an unknown, expired, or
    // already-used token — one message for all three (see UsersService).
    await this.commandBus.execute(new ResetUserPasswordCommand(dto.token, dto.password));
  }

  private buildAuthResponse(user: UserDto): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      // expiresIn comes from JwtModule.registerAsync in auth.module.ts — one
      // source of truth rather than repeating the config lookup per call site.
      accessToken: this.jwt.sign(payload),
      user,
    };
  }
}
