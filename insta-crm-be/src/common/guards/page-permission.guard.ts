import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccessLevel, AppPage, Role } from "@prisma/client";
import { PAGE_ACCESS_KEY } from "../decorators/page-access.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";
import { DEFAULT_ROLE_PERMISSIONS } from "../permissions/page-permissions";
import { PrismaService } from "../../prisma/prisma.service";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class PagePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enforces read or write access for routes associated with an application page.
   *
   * @param context - Current NestJS execution context.
   * @returns Whether the request may continue.
   * @throws ForbiddenException When the user lacks the required access level.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const page = this.reflector.getAllAndOverride<AppPage>(PAGE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!page) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new ForbiddenException("Authentication is required");
    if (request.user.role === "SUPER_ADMIN") return true;

    const permission = await this.prisma.userPagePermission.findUnique({
      where: {
        userId_page: { userId: request.user.sub, page },
      },
      select: { access: true },
    });
    const access = permission?.access ?? DEFAULT_ROLE_PERMISSIONS[request.user.role as Role][page];
    const required: AccessLevel = READ_METHODS.has(request.method) ? "READ" : "WRITE";
    const allowed = access === "WRITE" || (required === "READ" && access === "READ");
    if (!allowed) {
      throw new ForbiddenException(`You do not have ${required.toLowerCase()} access to this page`);
    }
    return true;
  }
}
