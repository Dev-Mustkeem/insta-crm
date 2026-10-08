import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
  ) {}

  async ingest(businessId: string, provider: string, payload: unknown) {
    const lead = this.normalize(payload);
    const existing = await this.prisma.marketplaceLead.findUnique({
      where: { businessId_provider_externalId: { businessId, provider, externalId: lead.externalId } },
      select: { id: true, contactId: true },
    });
    if (existing) return { received: true, duplicate: true, contactId: existing.contactId };
    const owner = await this.prisma.user.findFirst({
      where: { businessId, role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
      select: { id: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) throw new BadRequestException("Business owner not found");
    const created = await this.contacts.create(
      businessId,
      { sub: owner.id, businessId, role: owner.role, type: "access" },
      { name: lead.name, phone: lead.phone, ...(lead.email ? { email: lead.email } : {}), source: "marketplace", tags: [provider], customFields: {}, creditTermsDays: 30 },
    );
    const task = await this.prisma.task.findFirst({
      where: { businessId, relatedEntityId: created.contact.id, source: "CONTACT_CREATED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    await this.prisma.marketplaceLead.create({
      data: {
        businessId,
        provider,
        externalId: lead.externalId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        message: lead.message,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        contactId: created.contact.id,
        taskId: task?.id,
      },
    });
    return { received: true, duplicate: false, contactId: created.contact.id, taskId: task?.id ?? null };
  }

  private normalize(payload: unknown) {
    const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const text = (keys: string[]) => keys.map((key) => value[key]).find((item): item is string => typeof item === "string" && item.trim().length > 0)?.trim();
    const externalId = text(["lead_id", "leadId", "id"]);
    const name = text(["name", "sender_name", "senderName"]);
    const phone = text(["phone", "mobile", "sender_mobile", "senderMobile"]);
    if (!externalId || !name || !phone) throw new BadRequestException("Marketplace lead requires id, name, and phone");
    return { externalId, name: name.slice(0, 120), phone, email: text(["email", "sender_email", "senderEmail"]) ?? null, message: text(["message", "requirement", "subject"]) ?? null };
  }
}
