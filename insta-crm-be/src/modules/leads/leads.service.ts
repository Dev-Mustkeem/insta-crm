import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NeonStorageService } from "../storage/neon-storage.service";
import { SaveTrackerDto, TRACKER_STAGES } from "./dto/save-tracker.dto";
import { classifyLead, type ClassifiedLead } from "./lead-classifier";
import { parseLeadFile } from "./lead-parser";

const MAX_LEADS = 5000;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: NeonStorageService,
  ) {}

  async upload(
    businessId: string,
    file?: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    const { type, leads } = await parseLeadFile(file);
    if (leads.length > MAX_LEADS) {
      throw new BadRequestException(`A file may contain at most ${MAX_LEADS} leads.`);
    }
    const classified = leads
      .map((lead, index) => classifyLead(lead, index + 1))
      .sort((a, b) => b.score - a.score);
    const count = (tier: string) => classified.filter((l) => l.tier === tier).length;
    const storageKey = this.storageKey(businessId, file.originalname);
    await this.storage.putObject(
      storageKey,
      new Uint8Array(file.buffer),
      file.mimetype || "application/octet-stream",
    );
    try {
      const batch = await this.prisma.leadBatch.create({
        data: {
          businessId,
          fileName: file.originalname.slice(0, 200),
          fileType: type,
          storageKey,
          totalLeads: classified.length,
          hotCount: count("HOT"),
          warmCount: count("WARM"),
          coldCount: count("COLD"),
          leads: classified as unknown as object[],
        },
      });
      return this.present(batch);
    } catch (error) {
      await this.storage.deleteObject(storageKey).catch((cleanupError) => {
        this.logger.error(
          `Failed to clean up object ${storageKey}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      });
      throw error;
    }
  }

  async list(businessId: string) {
    const batches = await this.prisma.leadBatch.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, fileName: true, fileType: true, totalLeads: true,
        hotCount: true, warmCount: true, coldCount: true, createdAt: true,
      },
    });
    return batches;
  }

  async detail(businessId: string, id: string) {
    const batch = await this.prisma.leadBatch.findFirst({ where: { id, businessId } });
    if (!batch) throw new NotFoundException("Lead report not found.");
    const trackers = await this.prisma.leadTracker.findMany({
      where: { batchId: id, businessId },
      select: { leadId: true, stage: true },
    });
    const stages = Object.fromEntries(trackers.map((t) => [t.leadId, t.stage]));
    return { ...this.present(batch), stages };
  }

  async getTracker(businessId: string, batchId: string, leadId: number) {
    const batch = await this.prisma.leadBatch.findFirst({ where: { id: batchId, businessId } });
    const lead = (batch?.leads as unknown as ClassifiedLead[] | undefined)?.find((l) => l.id === leadId);
    if (!batch || !lead) throw new NotFoundException("Lead not found.");
    const tracker = await this.prisma.leadTracker.upsert({
      where: { batchId_leadId: { batchId, leadId } },
      update: {},
      create: { businessId, batchId, leadId },
    });
    return { batchId, fileName: batch.fileName, lead, tracker };
  }

  async saveTracker(businessId: string, batchId: string, leadId: number, dto: SaveTrackerDto) {
    const { tracker, ...rest } = await this.getTracker(businessId, batchId, leadId);
    const notes = { ...(tracker.stageNotes as Record<string, string>) };
    for (const [stage, text] of Object.entries(dto.stageNotes ?? {})) {
      if (!(TRACKER_STAGES as readonly string[]).includes(stage)) {
        throw new BadRequestException(`Unknown stage "${stage}".`);
      }
      if (typeof text !== "string" || text.length > 20000) {
        throw new BadRequestException("Each stage's notes must be text of at most 20,000 characters.");
      }
      notes[stage] = text;
    }
    const history = [...(tracker.history as { at: string; from: string; to: string }[])];
    if (dto.stage && dto.stage !== tracker.stage) {
      history.push({ at: new Date().toISOString(), from: tracker.stage, to: dto.stage });
    }
    const updated = await this.prisma.leadTracker.update({
      where: { id: tracker.id },
      data: {
        stage: dto.stage ?? tracker.stage,
        stageNotes: notes,
        history,
        ...(dto.nextFollowUp !== undefined
          ? { nextFollowUp: dto.nextFollowUp ? new Date(dto.nextFollowUp) : null }
          : {}),
      },
    });
    return { ...rest, tracker: updated };
  }

  async remove(businessId: string, id: string) {
    const batch = await this.prisma.leadBatch.findFirst({
      where: { id, businessId },
      select: { storageKey: true },
    });
    if (!batch) throw new NotFoundException("Lead report not found.");
    const { count } = await this.prisma.leadBatch.deleteMany({ where: { id, businessId } });
    if (!count) throw new NotFoundException("Lead report not found.");
    if (batch.storageKey) {
      await this.storage.deleteObject(batch.storageKey).catch((error) => {
        this.logger.error(
          `Failed to delete object ${batch.storageKey}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    }
    return { deleted: true };
  }

  /**
   * Creates a collision-resistant, tenant-scoped object key.
   *
   * @param businessId - Owning business identifier.
   * @param originalName - User-supplied source file name.
   * @returns A safe object key for the private bucket.
   */
  private storageKey(businessId: string, originalName: string): string {
    const safeName = originalName
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "upload";
    return `lead-imports/${businessId}/${randomUUID()}-${safeName}`;
  }

  private present(batch: {
    id: string; fileName: string; fileType: string; totalLeads: number;
    hotCount: number; warmCount: number; coldCount: number; createdAt: Date; leads: unknown;
  }) {
    return { ...batch, leads: batch.leads as ClassifiedLead[] };
  }
}
