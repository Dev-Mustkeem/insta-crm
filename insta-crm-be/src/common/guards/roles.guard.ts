import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { PAGE_ACCESS_KEY } from "../decorators/page-access.decorator";
import type { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const page = this.reflector.getAllAndOverride(PAGE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (page) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      !request.user ||
      (request.user.role !== "SUPER_ADMIN" &&
        !requiredRoles.includes(request.user.role as Role))
    ) {
      throw new ForbiddenException(
        "You do not have permission for this action",
      );
    }
    return true;
  }
}
