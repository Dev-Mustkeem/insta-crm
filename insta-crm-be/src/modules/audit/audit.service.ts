import { Injectable } from "@nestjs/common";
import type { AuditLogResponse } from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuditQueryDto } from "./audit-query.dto";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    businessId: string,
    query: AuditQueryDto,
  ): Promise<AuditLogResponse> {
    const where = {
      businessId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          action: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        metadata: item.metadata as Record<string, unknown>,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
    };
  }
}
