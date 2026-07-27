import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthResponse, UserDto } from "@expense-tracker/shared";

import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
// Value imports, not `import type`: the ValidationPipe needs the actual class
// at runtime, which it gets from emitDecoratorMetadata on the @Body() param.
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
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
}
