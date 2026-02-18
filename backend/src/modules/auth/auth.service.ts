import { createHash, randomBytes } from "crypto";
import {
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AdminPermission, Prisma, User, UserRole } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { authenticator } from "otplib";
import { PrismaService } from "../database/prisma.service";
import { EnableTwoFactorDto } from "./dto/enable-two-factor.dto";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { SetupTwoFactorDto } from "./dto/setup-two-factor.dto";

type UserWithSecurity = Prisma.UserGetPayload<{
  include: { security: true };
}>;

@Injectable()
export class AuthService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";
  private readonly accessTtl = process.env.JWT_ACCESS_TTL ?? "15m";
  private readonly refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 14);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async validateCredentials(
    email: string,
    password: string
  ): Promise<UserWithSecurity> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { security: true }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatched = await compare(password, user.passwordHash);
    if (!passwordMatched) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  private async getUserPermissions(user: User): Promise<AdminPermission[]> {
    if (user.role !== UserRole.ADMIN) {
      return [];
    }

    const grants = await this.prisma.adminPermissionGrant.findMany({
      where: { userId: user.id },
      select: { permission: true },
      orderBy: { permission: "asc" }
    });

    return grants.map((row) => row.permission);
  }

  private signAccessToken(user: User): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtl as never
      }
    );
  }

  private signRefreshJwt(user: User, refreshTokenId: string): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        type: "refresh",
        rtid: refreshTokenId
      },
      {
        secret: this.refreshSecret,
        expiresIn: `${this.refreshTtlDays}d` as never
      }
    );
  }

  private async createSession(
    prisma: Prisma.TransactionClient | PrismaService,
    user: User,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const plainRefreshToken = randomBytes(48).toString("hex");
    const tokenHash = this.hashRefreshToken(plainRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);

    const refreshTokenRow = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent
      }
    });

    const accessToken = this.signAccessToken(user);
    const refreshJwt = this.signRefreshJwt(user, refreshTokenRow.id);

    return {
      accessToken,
      refreshToken: plainRefreshToken,
      refreshTokenJwt: refreshJwt,
      tokenType: "Bearer" as const,
      accessTokenTtl: this.accessTtl,
      refreshTokenExpiresAt: expiresAt.toISOString()
    };
  }

  async register(input: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existing) {
      throw new ConflictException("Email is already in use");
    }

    const passwordHash = await hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        security: { create: {} },
        balances: {
          create: [
            { asset: "USDT", available: "0", locked: "0" },
            { asset: "BTC", available: "0", locked: "0" }
          ]
        }
      }
    });

    const tokens = await this.createSession(this.prisma, user);

    return {
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      permissions: [],
      tokens
    };
  }

  async login(input: LoginDto) {
    const user = await this.validateCredentials(input.email, input.password);
    // 2FA is enforced at order placement, not at login

    const tokens = await this.createSession(this.prisma, user, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });
    const permissions = await this.getUserPermissions(user);

    return {
      user: {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      permissions,
      tokens
    };
  }

  async refresh(input: RefreshTokenDto) {
    const tokenHash = this.hashRefreshToken(input.refreshToken);
    const currentToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!currentToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (currentToken.revokedAt) {
      throw new UnauthorizedException("Refresh token already revoked");
    }
    if (currentToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: currentToken.id },
        data: { revokedAt: new Date() }
      });

      const tokens = await this.createSession(tx, currentToken.user, {
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
      const permissions = await this.getUserPermissions(currentToken.user);

      return {
        user: {
          userId: currentToken.user.id,
          email: currentToken.user.email,
          role: currentToken.user.role
        },
        permissions,
        tokens
      };
    });
  }

  async logout(input: LogoutDto) {
    const tokenHash = this.hashRefreshToken(input.refreshToken);
    const currentToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!currentToken) {
      return { revoked: false };
    }

    if (!currentToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: currentToken.id },
        data: { revokedAt: new Date() }
      });
    }

    return { revoked: true };
  }

  async setupTwoFactor(input: SetupTwoFactorDto) {
    const user = await this.validateCredentials(input.email, input.password);
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, "GnnDEX", secret);

    await this.prisma.userSecurity.upsert({
      where: { userId: user.id },
      update: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
        twoFactorVerifiedAt: null
      },
      create: {
        userId: user.id,
        twoFactorSecret: secret,
        twoFactorEnabled: false
      }
    });

    return {
      email: user.email,
      secret,
      otpauthUrl
    };
  }

  async enableTwoFactor(input: EnableTwoFactorDto) {
    const user = await this.validateCredentials(input.email, input.password);
    const security = user.security;
    if (!security?.twoFactorSecret) {
      throw new UnauthorizedException("2FA setup is required first");
    }

    const verified = authenticator.check(input.code, security.twoFactorSecret);
    if (!verified) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    await this.prisma.userSecurity.update({
      where: { userId: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorVerifiedAt: new Date()
      }
    });

    return {
      enabled: true,
      email: user.email
    };
  }
}
