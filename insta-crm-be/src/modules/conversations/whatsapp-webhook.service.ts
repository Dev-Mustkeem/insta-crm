import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ConversationChannel,
  MessageDirection,
  MessageStatus,
  WhatsAppCampaignRecipientStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";
import { normalizePhone } from "../contacts/contacts.utils";

@Injectable()
export class WhatsAppWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
  ) {}

  async process(payload: unknown) {
    const entries = this.arrayProperty(payload, "entry");
    let inboundMessages = 0;
    let statusUpdates = 0;
    for (const entry of entries) {
      for (const change of this.arrayProperty(entry, "changes")) {
        const value = this.objectProperty(change, "value");
        if (!value) continue;
        const messages = this.arrayProperty(value, "messages");
        const statuses = this.arrayProperty(value, "statuses");
        if (!messages.length && !statuses.length) continue;

        const metadata = this.objectProperty(value, "metadata");
        const phoneNumberId = this.stringProperty(metadata, "phone_number_id");
        if (!phoneNumberId) continue;
        const connection = await this.prisma.whatsAppConnection.findFirst({
          where: { phoneNumberId, enabled: true, deletedAt: null },
          select: { businessId: true },
        });
        if (!connection) {
          throw new NotFoundException(
            "No active business connection matches this phone number",
          );
        }
        const profileNames = this.contactNames(value);
        for (const message of messages) {
          if (
            await this.processInbound(
              connection.businessId,
              message,
              profileNames,
            )
          ) {
            inboundMessages += 1;
          }
        }
        for (const status of statuses) {
          if (await this.processStatus(connection.businessId, status)) {
            statusUpdates += 1;
          }
        }
      }
    }
    return { inboundMessages, statusUpdates };
  }

  private async processInbound(
    businessId: string,
    value: unknown,
    profileNames: Map<string, string>,
  ) {
    if (!value || typeof value !== "object") return false;
    const message = value as Record<string, unknown>;
    const externalMessageId = this.stringProperty(message, "id");
    const from = this.stringProperty(message, "from");
    if (!externalMessageId || !from) return false;
    const duplicate = await this.prisma.message.findFirst({
      where: { businessId, externalMessageId },
      select: { id: true },
    });
    if (duplicate) return false;

    const normalizedPhone = normalizePhone(from);
    let contact = await this.prisma.contact.findFirst({
      where: { businessId, normalizedPhone, deletedAt: null },
      select: { id: true, name: true, phone: true, assignedToId: true },
    });
    if (!contact) {
      const owner = await this.prisma.user.findFirst({
        where: { businessId, role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
        select: { id: true, role: true },
        orderBy: { createdAt: "asc" },
      });
      if (!owner) throw new NotFoundException("Business owner not found");
      const created = await this.contacts.create(
        businessId,
        { sub: owner.id, businessId, role: owner.role, type: "access" },
        {
          name: (profileNames.get(from) || "WhatsApp contact").slice(0, 120),
          phone: from,
          source: "whatsapp",
          tags: ["whatsapp"],
          customFields: {},
          creditTermsDays: 30,
        },
      );
      contact = {
        id: created.contact.id,
        name: created.contact.name,
        phone: created.contact.phone,
        assignedToId: created.contact.assignedTo.id,
      };
    }

    const conversation = await this.prisma.conversation.upsert({
      where: {
        businessId_channel_contactId: {
          businessId,
          channel: ConversationChannel.WHATSAPP,
          contactId: contact.id,
        },
      },
      create: {
        businessId,
        contactId: contact.id,
        channel: ConversationChannel.WHATSAPP,
        assignedToId: contact.assignedToId,
      },
      update: { deletedAt: null },
      select: { id: true },
    });
    const createdAt = this.eventDate(message);
    const body = this.messageBody(message);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.message.create({
          data: {
            businessId,
            conversationId: conversation.id,
            direction: MessageDirection.INBOUND,
            body,
            status: MessageStatus.DELIVERED,
            externalMessageId,
            deliveredAt: createdAt,
            createdAt,
          },
        });
        await transaction.conversation.updateMany({
          where: { id: conversation.id, businessId, deletedAt: null },
          data: {
            lastMessageAt: createdAt,
            unreadCount: { increment: 1 },
          },
        });
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return false;
      }
      throw error;
    }
  }

  private async processStatus(businessId: string, value: unknown) {
    if (!value || typeof value !== "object") return false;
    const event = value as Record<string, unknown>;
    const externalMessageId = this.stringProperty(event, "id");
    const providerStatus = this.stringProperty(event, "status")?.toLowerCase();
    if (!externalMessageId || !providerStatus) return false;
    const nextStatus = this.statusValue(providerStatus);
    if (!nextStatus) return false;
    const existing = await this.prisma.message.findFirst({
      where: { businessId, externalMessageId },
      select: { id: true, status: true },
    });
    if (!existing || !this.shouldAdvance(existing.status, nextStatus)) {
      return false;
    }
    const occurredAt = this.eventDate(event);
    await this.prisma.message.updateMany({
      where: { id: existing.id, businessId, externalMessageId },
      data: {
        status: nextStatus,
        ...(nextStatus === MessageStatus.DELIVERED
          ? { deliveredAt: occurredAt }
          : {}),
        ...(nextStatus === MessageStatus.READ ? { readAt: occurredAt } : {}),
        ...(nextStatus === MessageStatus.FAILED
          ? { failedAt: occurredAt }
          : {}),
      },
    });
    await this.prisma.whatsAppCampaignRecipient.updateMany({
      where: { businessId, externalMessageId },
      data: {
        status: nextStatus === MessageStatus.READ
          ? WhatsAppCampaignRecipientStatus.READ
          : nextStatus === MessageStatus.DELIVERED
            ? WhatsAppCampaignRecipientStatus.DELIVERED
            : WhatsAppCampaignRecipientStatus.FAILED,
        ...(nextStatus === MessageStatus.DELIVERED ? { deliveredAt: occurredAt } : {}),
        ...(nextStatus === MessageStatus.READ ? { readAt: occurredAt } : {}),
        ...(nextStatus === MessageStatus.FAILED ? { failedAt: occurredAt } : {}),
      },
    });
    return true;
  }

  private contactNames(value: Record<string, unknown>) {
    const result = new Map<string, string>();
    for (const item of this.arrayProperty(value, "contacts")) {
      const waId = this.stringProperty(item, "wa_id");
      const profile = this.objectProperty(item, "profile");
      const name = this.stringProperty(profile, "name");
      if (waId && name) result.set(waId, name);
    }
    return result;
  }

  private messageBody(message: Record<string, unknown>): string {
    const type = this.stringProperty(message, "type") || "unknown";
    if (type === "text") {
      return (
        this.stringProperty(this.objectProperty(message, "text"), "body") ||
        "[Text message]"
      );
    }
    if (type === "button") {
      return (
        this.stringProperty(this.objectProperty(message, "button"), "text") ||
        "[Button reply]"
      );
    }
    if (type === "interactive") {
      const interactive = this.objectProperty(message, "interactive");
      const button = this.objectProperty(interactive, "button_reply");
      const list = this.objectProperty(interactive, "list_reply");
      return (
        this.stringProperty(button, "title") ||
        this.stringProperty(list, "title") ||
        "[Interactive reply]"
      );
    }
    const media = this.objectProperty(message, type);
    const caption = this.stringProperty(media, "caption");
    return caption ? "[" + type + "] " + caption : "[" + type + "]";
  }

  private statusValue(value: string): MessageStatus | null {
    if (value === "sent") return MessageStatus.SENT;
    if (value === "delivered") return MessageStatus.DELIVERED;
    if (value === "read") return MessageStatus.READ;
    if (value === "failed") return MessageStatus.FAILED;
    return null;
  }

  private shouldAdvance(current: MessageStatus, next: MessageStatus) {
    if (current === next) return false;
    if (next === MessageStatus.FAILED) return current !== MessageStatus.READ;
    if (current === MessageStatus.FAILED) return false;
    const rank = {
      SENT: 1,
      DELIVERED: 2,
      READ: 3,
      FAILED: 0,
    } satisfies Record<MessageStatus, number>;
    return rank[next] > rank[current];
  }

  private eventDate(value: Record<string, unknown>) {
    const timestamp = this.stringProperty(value, "timestamp");
    const milliseconds = timestamp ? Number(timestamp) * 1000 : Date.now();
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private arrayProperty(value: unknown, key: string): unknown[] {
    const object = this.asObject(value);
    const property = object?.[key];
    return Array.isArray(property) ? property : [];
  }

  private objectProperty(
    value: unknown,
    key: string,
  ): Record<string, unknown> | null {
    const object = this.asObject(value);
    return this.asObject(object?.[key]);
  }

  private stringProperty(value: unknown, key: string): string | null {
    const object = this.asObject(value);
    const property = object?.[key];
    return typeof property === "string" ? property : null;
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  }
}
