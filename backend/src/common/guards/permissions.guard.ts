import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { AdminPermission } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { PrismaService } from "../../modules/database/prisma.service";

type RequestWithUser = { user?: AuthenticatedUser };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<AdminPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Authenticated user context is missing");
    }

    const grants = await this.prisma.adminPermissionGrant.findMany({
      where: {
        userId: user.sub,
        permission: {
          in: requiredPermissions
        }
      },
      select: {
        permission: true
      }
    });

    const grantedSet = new Set(grants.map((item) => item.permission));
    const missing = requiredPermissions.filter((permission) => !grantedSet.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(", ")}`
      );
    }

    return true;
  }
}
