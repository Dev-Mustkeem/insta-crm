import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  DealActivity,
  DealSummary,
  PipelineStageSummary,
} from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import type { CreateDealDto } from "./dto/create-deal.dto";
import type { ListDealsQueryDto } from "./dto/list-deals-query.dto";
import type { UpdateDealDto } from "./dto/update-deal.dto";

const dealSelect = {
  id: true,
  title: true,
  value: true,
  createdAt: true,
  updatedAt: true,
  stage: {
    select: {
      id: true,
      name: true,
      position: true,
      color: true,
      isWon: true,
      isLost: true,
    },
  },
  contact: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.DealSelect;

type DealRecord = Prisma.DealGetPayload<{ select: typeof dealSelect }>;

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    businessId: string,
    actor: JwtPayload,
    dto: CreateDealDto,
  ): Promise<DealSummary> {
    if (
      actor.role === "STAFF" &&
      dto.assignedToId &&
      dto.assignedToId !== actor.sub
    ) {
      throw new ForbiddenException("Staff cannot assign deals to another user");
    }
    const assignedToId =
      actor.role === "STAFF" ? actor.sub : (dto.assignedToId ?? actor.sub);
    const stageId = dto.stageId ?? (await this.defaultStageId(businessId));
    await Promise.all([
      this.assertContact(businessId, actor, dto.contactId),
      this.assertUser(businessId, assignedToId),
      this.assertStage(businessId, stageId),
    ]);

    const deal = await this.prisma.deal.create({
      data: {
        businessId,
        title: dto.title,
        value: dto.value,
        contactId: dto.contactId,
        assignedToId,
        stageId,
      },
      select: dealSelect,
    });
    return this.toResponse(deal);
  }

  async list(businessId: string, actor: JwtPayload, query: ListDealsQueryDto) {
    const where: Prisma.DealWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.stageId ? { stageId: query.stageId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...this.assignmentScope(actor),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              {
                contact: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        select: dealSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: query.limit,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return {
      items: items.map((deal) => this.toResponse(deal)),
      total,
    };
  }

  async findOne(
    businessId: string,
    actor: JwtPayload,
    dealId: string,
  ): Promise<DealSummary> {
    const deal = await this.prisma.deal.findFirst({
      where: {
        id: dealId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: dealSelect,
    });
    if (!deal) throw new NotFoundException("Deal not found");
    return this.toResponse(deal);
  }

  async update(
    businessId: string,
    actor: JwtPayload,
    dealId: string,
    dto: UpdateDealDto,
  ): Promise<DealSummary> {
    const existing = await this.prisma.deal.findFirst({
      where: {
        id: dealId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Deal not found");
    if (
      actor.role === "STAFF" &&
      dto.assignedToId &&
      dto.assignedToId !== actor.sub
    ) {
      throw new ForbiddenException("Staff cannot reassign deals");
    }
    await Promise.all([
      dto.contactId
        ? this.assertContact(businessId, actor, dto.contactId)
        : Promise.resolve(),
      dto.assignedToId
        ? this.assertUser(businessId, dto.assignedToId)
        : Promise.resolve(),
    ]);

    await this.prisma.deal.updateMany({
      where: {
        id: dealId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.contactId !== undefined ? { contactId: dto.contactId } : {}),
        ...(dto.assignedToId !== undefined
          ? { assignedToId: dto.assignedToId }
          : {}),
      },
    });
    const deal = await this.prisma.deal.findFirstOrThrow({
      where: {
        id: dealId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: dealSelect,
    });
    return this.toResponse(deal);
  }

  async moveStage(
    businessId: string,
    actor: JwtPayload,
    dealId: string,
    toStageId: string,
  ): Promise<DealSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const [deal, toStage] = await Promise.all([
        transaction.deal.findFirst({
          where: {
            id: dealId,
            businessId,
            deletedAt: null,
            ...this.assignmentScope(actor),
          },
          select: {
            id: true,
            stageId: true,
            stage: { select: { name: true } },
          },
        }),
        transaction.pipelineStage.findFirst({
          where: { id: toStageId, businessId, deletedAt: null },
          select: { id: true, name: true },
        }),
      ]);
      if (!deal) throw new NotFoundException("Deal not found");
      if (!toStage) throw new BadRequestException("Target stage not found");

      if (deal.stageId !== toStage.id) {
        await transaction.deal.updateMany({
          where: { id: dealId, businessId, deletedAt: null },
          data: { stageId: toStage.id, stageChangedAt: new Date() },
        });
        await transaction.activityLog.create({
          data: {
            businessId,
            actorId: actor.sub,
            entityType: "deal",
            entityId: dealId,
            action: "stage_changed",
            metadata: {
              fromStageId: deal.stageId,
              fromStageName: deal.stage.name,
              toStageId: toStage.id,
              toStageName: toStage.name,
            },
          },
        });
      }

      const updated = await transaction.deal.findFirstOrThrow({
        where: { id: dealId, businessId, deletedAt: null },
        select: dealSelect,
      });
      return this.toResponse(updated);
    });
  }

  async activities(
    businessId: string,
    actor: JwtPayload,
    dealId: string,
  ): Promise<DealActivity[]> {
    await this.findOne(businessId, actor, dealId);
    const activities = await this.prisma.activityLog.findMany({
      where: {
        businessId,
        entityType: "deal",
        entityId: dealId,
        action: "stage_changed",
      },
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return activities.map((activity) => ({
      id: activity.id,
      action: "stage_changed",
      actor: activity.actor,
      metadata: activity.metadata as DealActivity["metadata"],
      createdAt: activity.createdAt.toISOString(),
    }));
  }

  async remove(businessId: string, actor: JwtPayload, dealId: string) {
    const result = await this.prisma.deal.updateMany({
      where: {
        id: dealId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException("Deal not found");
    return { success: true };
  }

  private async defaultStageId(businessId: string): Promise<string> {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { businessId, deletedAt: null },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    if (!stage) {
      throw new BadRequestException("Configure a pipeline stage first");
    }
    return stage.id;
  }

  private async assertContact(
    businessId: string,
    actor: JwtPayload,
    contactId: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        businessId,
        deletedAt: null,
        ...(actor.role === "STAFF" ? { assignedToId: actor.sub } : {}),
      },
      select: { id: true },
    });
    if (!contact) throw new BadRequestException("Selected contact not found");
  }

  private async assertUser(businessId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new BadRequestException("Assignee not found");
  }

  private async assertStage(businessId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!stage) throw new BadRequestException("Pipeline stage not found");
  }

  private assignmentScope(actor: JwtPayload): Prisma.DealWhereInput {
    return actor.role === "STAFF" ? { assignedToId: actor.sub } : {};
  }

  private stageResponse(stage: DealRecord["stage"]): PipelineStageSummary {
    return {
      id: stage.id,
      name: stage.name,
      position: stage.position,
      color: stage.color,
      category: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
    };
  }

  private toResponse(deal: DealRecord): DealSummary {
    return {
      id: deal.id,
      title: deal.title,
      value: Number(deal.value),
      stage: this.stageResponse(deal.stage),
      contact: deal.contact,
      assignedTo: deal.assignedTo,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
    };
  }
}
