import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ContactSource, Prisma, WhatsAppCampaignRecipientStatus, WhatsAppCampaignStatus } from "@prisma/client";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import type { CreateBroadcastDto } from "./dto/create-broadcast.dto";

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async createAndSend(businessId: string, actor: JwtPayload, dto: CreateBroadcastDto) {
    const source = dto.source ? this.source(dto.source) : undefined;
    const campaign = await this.prisma.whatsAppCampaign.create({
      data: {
        businessId,
        createdById: actor.sub,
        name: dto.name,
        templateName: dto.templateName,
        templateLanguage: dto.templateLanguage,
        parameters: dto.parameters,
        tagFilter: dto.tag?.trim() || null,
        sourceFilter: source,
        status: WhatsAppCampaignStatus.SENDING,
      },
    });
    const contacts = await this.prisma.contact.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(dto.tag ? { tags: { has: dto.tag.trim().toLowerCase() } } : {}),
        ...(source ? { source } : {}),
      },
      select: { id: true, phone: true, whatsappOptedOut: true },
    });
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const contact of contacts) {
      if (contact.whatsappOptedOut) {
        skipped += 1;
        await this.prisma.whatsAppCampaignRecipient.create({
          data: { businessId, campaignId: campaign.id, contactId: contact.id, status: WhatsAppCampaignRecipientStatus.SKIPPED_OPT_OUT },
        });
        continue;
      }
      const recipient = await this.prisma.whatsAppCampaignRecipient.create({
        data: { businessId, campaignId: campaign.id, contactId: contact.id },
      });
      try {
        const result = await this.whatsapp.sendTemplate(
          businessId,
          contact.phone,
          dto.templateName,
          dto.templateLanguage,
          dto.parameters,
        );
        sent += 1;
        await this.prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: WhatsAppCampaignRecipientStatus.SENT, externalMessageId: result.externalMessageId, sentAt: new Date() },
        });
      } catch (error) {
        failed += 1;
        await this.prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: WhatsAppCampaignRecipientStatus.FAILED, failedAt: new Date(), failureReason: error instanceof Error ? error.message : "Send failed" },
        });
      }
    }
    await this.prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { status: failed && !sent ? WhatsAppCampaignStatus.FAILED : WhatsAppCampaignStatus.COMPLETED } });
    return { id: campaign.id, total: contacts.length, sent, skipped, failed };
  }

  list(businessId: string) {
    return this.prisma.whatsAppCampaign.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { recipients: { select: { status: true } } },
      take: 100,
    }).then((campaigns) => campaigns.map((campaign) => this.withMetrics(campaign)));
  }

  async detail(businessId: string, id: string) {
    const campaign = await this.prisma.whatsAppCampaign.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { recipients: { select: { status: true } } },
    });
    if (!campaign) throw new NotFoundException("Broadcast campaign not found");
    return this.withMetrics(campaign);
  }

  private withMetrics<T extends { recipients: Array<{ status: WhatsAppCampaignRecipientStatus }> }>(campaign: T) {
    const counts = campaign.recipients.reduce<Record<string, number>>((result, recipient) => {
      result[recipient.status] = (result[recipient.status] ?? 0) + 1;
      return result;
    }, {});
    const delivered = (counts.DELIVERED ?? 0) + (counts.READ ?? 0);
    return { ...campaign, recipients: undefined, metrics: { ...counts, deliveryRate: this.rate(delivered, campaign.recipients.length), readRate: this.rate(counts.READ ?? 0, delivered) } };
  }

  private rate(value: number, total: number) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  private source(value: string): ContactSource {
    const source = value.toUpperCase().replace("-", "_") as ContactSource;
    if (!Object.values(ContactSource).includes(source)) throw new BadRequestException("Invalid contact source");
    return source;
  }
}