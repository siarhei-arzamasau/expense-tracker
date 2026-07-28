import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthResponse, UserDto } from "@expense-tracker/shared";

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

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Create an account and return an access token" })
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exchange credentials for an access token" })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the currently authenticated user" })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.authService.findById(user.id);
  }

  // No JwtAuthGuard on either endpoint below — the caller is not
  // authenticated by definition.

  @Post("forgot-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Request a password reset link (logged, not emailed, in this template)",
  })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.authService.requestPasswordReset(dto);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reset a password using a token from the reset link" })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }
}
