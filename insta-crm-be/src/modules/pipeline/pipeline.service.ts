import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PipelineStageCategory,
  PipelineStageSummary,
} from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import type { CreateStageDto } from "./dto/create-stage.dto";
import type { UpdateStageDto } from "./dto/update-stage.dto";
import { DEFAULT_PIPELINE_STAGES } from "./pipeline.constants";

const stageSelect = {
  id: true,
  name: true,
  position: true,
  color: true,
  isWon: true,
  isLost: true,
} as const;

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async listStages(businessId: string): Promise<PipelineStageSummary[]> {
    await this.ensureDefaultStages(businessId);
    const stages = await this.prisma.pipelineStage.findMany({
      where: { businessId, deletedAt: null },
      select: stageSelect,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return stages.map((stage) => this.toResponse(stage));
  }

  async options(businessId: string, actor: JwtPayload) {
    const [stages, users] = await Promise.all([
      this.listStages(businessId),
      this.prisma.user.findMany({
        where: {
          businessId,
          deletedAt: null,
          role: { in: ["SUPER_ADMIN", "OWNER", "STAFF"] },
          ...(actor.role === "STAFF" ? { id: actor.sub } : {}),
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { stages, users, canManageStages: ["SUPER_ADMIN", "OWNER"].includes(actor.role) };
  }

  async createStage(businessId: string, dto: CreateStageDto) {
    await this.assertUniqueName(businessId, dto.name);
    const position = await this.nextPosition(businessId);
    const stage = await this.prisma.pipelineStage.create({
      data: {
        businessId,
        name: dto.name,
        color: dto.color,
        position,
        ...this.categoryFlags(dto.category),
      },
      select: stageSelect,
    });
    return this.toResponse(stage);
  }

  async updateStage(businessId: string, stageId: string, dto: UpdateStageDto) {
    const existing = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Pipeline stage not found");
    if (dto.name) await this.assertUniqueName(businessId, dto.name, stageId);

    await this.prisma.pipelineStage.updateMany({
      where: { id: stageId, businessId, deletedAt: null },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.category !== undefined ? this.categoryFlags(dto.category) : {}),
      },
    });
    const stage = await this.prisma.pipelineStage.findFirstOrThrow({
      where: { id: stageId, businessId, deletedAt: null },
      select: stageSelect,
    });
    return this.toResponse(stage);
  }

  async removeStage(businessId: string, stageId: string) {
    const [stage, activeStageCount, dealCount] = await Promise.all([
      this.prisma.pipelineStage.findFirst({
        where: { id: stageId, businessId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.pipelineStage.count({
        where: { businessId, deletedAt: null },
      }),
      this.prisma.deal.count({
        where: { businessId, stageId, deletedAt: null },
      }),
    ]);
    if (!stage) throw new NotFoundException("Pipeline stage not found");
    if (activeStageCount <= 1) {
      throw new ConflictException("A pipeline must keep at least one stage");
    }
    if (dealCount > 0) {
      throw new ConflictException(
        "Move active deals out of this stage before deleting it",
      );
    }

    await this.prisma.pipelineStage.updateMany({
      where: { id: stageId, businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  private async ensureDefaultStages(businessId: string) {
    const count = await this.prisma.pipelineStage.count({
      where: { businessId, deletedAt: null },
    });
    if (count > 0) return;
    await this.prisma.pipelineStage.createMany({
      data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
        businessId,
        ...stage,
      })),
    });
  }

  private async assertUniqueName(
    businessId: string,
    name: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.pipelineStage.findFirst({
      where: {
        businessId,
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException("A pipeline stage with this name exists");
    }
  }

  private async nextPosition(businessId: string): Promise<number> {
    const result = await this.prisma.pipelineStage.aggregate({
      where: { businessId, deletedAt: null },
      _max: { position: true },
    });
    return (result._max.position ?? -1) + 1;
  }

  private categoryFlags(category: PipelineStageCategory) {
    return {
      isWon: category === "won",
      isLost: category === "lost",
    };
  }

  private toResponse(stage: {
    id: string;
    name: string;
    position: number;
    color: string;
    isWon: boolean;
    isLost: boolean;
  }): PipelineStageSummary {
    return {
      id: stage.id,
      name: stage.name,
      position: stage.position,
      color: stage.color,
      category: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
    };
  }
}
