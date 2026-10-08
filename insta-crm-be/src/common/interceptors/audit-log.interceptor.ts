import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Response } from "express";
import type { Observable } from "rxjs";
import { concatMap } from "rxjs/operators";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      !request.user ||
      !request.businessId ||
      !mutatingMethods.has(request.method) ||
      request.path.endsWith("/stage")
    ) {
      return next.handle();
    }
    return next.handle().pipe(
      concatMap(async (response: unknown) => {
        await this.write(
          request,
          context.switchToHttp().getResponse<Response>(),
          response,
        );
        return response;
      }),
    );
  }

  private async write(
    request: AuthenticatedRequest,
    response: Response,
    body: unknown,
  ) {
    const user = request.user;
    if (!user || response.statusCode >= 400) return;
    const pathParts = request.path
      .split("/")
      .filter((part) => part && part !== "api");
    const entityType = pathParts[0] ?? "unknown";
    const entityId =
      this.entityId(request, body) ??
      (entityType === "business" ? user.businessId : user.sub);
    const action =
      request.method === "POST"
        ? "created"
        : request.method === "DELETE"
          ? "deleted"
          : "updated";
    try {
      await this.prisma.activityLog.create({
        data: {
          businessId: user.businessId,
          actorId: user.sub,
          entityType,
          entityId,
          action,
          metadata: {
            path: request.path,
            parameters: request.params,
            fields: this.changedFields(request.body),
          },
        },
      });
    } catch {
      // Auditing must not turn a successful business action into an API error.
    }
  }

  private entityId(
    request: AuthenticatedRequest,
    body: unknown,
  ): string | null {
    const candidates = [
      request.params?.id,
      this.value(body, "id"),
      this.value(body, "contact.id"),
      this.value(body, "invoice.id"),
    ];
    return candidates.find((value) => value && uuidPattern.test(value)) ?? null;
  }

  private value(input: unknown, path: string): string | null {
    let current: unknown = input;
    for (const part of path.split(".")) {
      if (!current || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : null;
  }

  private changedFields(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return [];
    return Object.keys(body as Record<string, unknown>).filter(
      (key) => !/(password|token|secret|api.?key|auth.?key)/i.test(key),
    );
  }
}
