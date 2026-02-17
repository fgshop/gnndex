import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

type RequestWithUser = {
  user?: AuthenticatedUser;
  headers?: { authorization?: string };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers?.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("Bearer ".length);

    try {
      const payload = this.jwtService.verify<AuthenticatedUser>(token, {
        secret: this.accessSecret
      });

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
