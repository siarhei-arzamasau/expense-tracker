import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AuthResponse, UserDto } from "@expense-tracker/shared";
import * as argon2 from "argon2";

import { PrismaService } from "../prisma/prisma.service";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { JwtPayload } from "./types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with that email already exists");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name ?? null,
        password: await argon2.hash(dto.password),
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Same message and roughly the same work either way, so the response does
    // not reveal whether the email exists.
    if (!user || !(await argon2.verify(user.password, dto.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.buildAuthResponse(user);
  }

  async findById(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toUserDto(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  }): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwt.sign(payload, {
        expiresIn: this.config.get<string>("JWT_EXPIRES_IN", "7d"),
      }),
      user: this.toUserDto(user),
    };
  }

  private toUserDto(user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  }): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
