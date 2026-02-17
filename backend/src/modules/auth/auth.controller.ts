import { Body, Controller, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ErrorResponseDto } from "../../common/dto/error-response.dto";
import { ThrottleAuth, ThrottleRegister } from "../../common/decorators/throttle.decorator";
import { EnableTwoFactorDto } from "./dto/enable-two-factor.dto";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { SetupTwoFactorDto } from "./dto/setup-two-factor.dto";

@ApiTags("auth")
@Controller("auth")
@ApiTooManyRequestsResponse({ description: "Rate limit exceeded", type: ErrorResponseDto })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register user" })
  @ApiConflictResponse({ description: "Email already in use", type: ErrorResponseDto })
  @ThrottleRegister()
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post("login")
  @ApiOperation({ summary: "Login user" })
  @ApiUnauthorizedResponse({ description: "Invalid credentials", type: ErrorResponseDto })
  @ThrottleAuth()
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate refresh token and issue new tokens" })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token", type: ErrorResponseDto })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body);
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke refresh token session" })
  async logout(@Body() body: LogoutDto) {
    return this.authService.logout(body);
  }

  @Post("2fa/setup")
  @ApiOperation({ summary: "Generate TOTP secret for 2FA setup" })
  @ApiBearerAuth("bearer")
  @ApiUnauthorizedResponse({ description: "Invalid credentials", type: ErrorResponseDto })
  @ThrottleAuth()
  async setupTwoFactor(@Body() body: SetupTwoFactorDto) {
    return this.authService.setupTwoFactor(body);
  }

  @Post("2fa/enable")
  @ApiOperation({ summary: "Enable 2FA after verifying TOTP code" })
  @ApiBearerAuth("bearer")
  @ApiUnauthorizedResponse({ description: "Invalid 2FA code", type: ErrorResponseDto })
  @ThrottleAuth()
  async enableTwoFactor(@Body() body: EnableTwoFactorDto) {
    return this.authService.enableTwoFactor(body);
  }
}
