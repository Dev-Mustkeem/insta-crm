import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConversationChannel,
  ContactSource,
  MessageDirection,
  MessageStatus,
  RelatedEntityType,
  TaskSource,
} from "@prisma/client";
import type { ChannelSettings } from "@insta-crm/shared-types";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Webhook } from "svix";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePhone } from "../contacts/contacts.utils";
import type { UpdateChannelSettingsDto } from "./dto/update-channel-settings.dto";

type IncomingChannel = "SMS" | "EMAIL";

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async settings(businessId: string): Promise<ChannelSettings> {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { businessId, deletedAt: null },
    });
    if (!connection) return this.emptySettings();
    return {
      sms: {
        configured: Boolean(
          connection.smsAuthKeyEncrypted && connection.smsFlowId,
        ),
        enabled: connection.smsEnabled,
        flowId: connection.smsFlowId,
        senderId: connection.smsSenderId,
        messageVariable: connection.smsMessageVariable,
        webhookConnectionId: connection.id,
      },
      email: {
        configured: Boolean(
          connection.resendApiKeyEncrypted &&
          connection.resendFromEmail &&
          connection.resendReceivingAddress &&
          connection.resendWebhookSecretEncrypted,
        ),
        enabled: connection.emailEnabled,
        fromName: connection.resendFromName,
        fromEmail: connection.resendFromEmail,
        receivingAddress: connection.resendReceivingAddress,
      },
    };
  }

  async configure(businessId: string, dto: UpdateChannelSettingsDto) {
    const existing = await this.prisma.channelConnection.findFirst({
      where: { businessId },
    });
    const smsAuthKeyEncrypted = dto.smsAuthKey
      ? this.encrypt(dto.smsAuthKey)
      : existing?.smsAuthKeyEncrypted;
    const resendApiKeyEncrypted = dto.resendApiKey
      ? this.encrypt(dto.resendApiKey)
      : existing?.resendApiKeyEncrypted;
    const resendWebhookSecretEncrypted = dto.resendWebhookSecret
      ? this.encrypt(dto.resendWebhookSecret)
      : existing?.resendWebhookSecretEncrypted;
    const smsWebhookTokenHash = dto.smsWebhookToken
      ? this.hash(dto.smsWebhookToken)
      : existing?.smsWebhookTokenHash;
    const smsFlowId = dto.smsFlowId ?? existing?.smsFlowId ?? null;
    const resendFromEmail =
      dto.resendFromEmail ?? existing?.resendFromEmail ?? null;
    const resendReceivingAddress =
      dto.resendReceivingAddress ?? existing?.resendReceivingAddress ?? null;

    if (
      dto.smsEnabled &&
      (!smsAuthKeyEncrypted || !smsFlowId || !smsWebhookTokenHash)
    ) {
      throw new BadRequestException(
        "SMS requires an MSG91 auth key, flow ID, and webhook token",
      );
    }
    if (
      dto.emailEnabled &&
      (!resendApiKeyEncrypted ||
        !resendFromEmail ||
        !resendReceivingAddress ||
        !resendWebhookSecretEncrypted)
    ) {
      throw new BadRequestException(
        "Email requires a Resend key, sender, receiving address, and webhook secret",
      );
    }

    await this.prisma.channelConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        smsAuthKeyEncrypted,
        smsFlowId,
        smsSenderId: dto.smsSenderId ?? null,
        smsMessageVariable: dto.smsMessageVariable,
        smsWebhookTokenHash,
        smsEnabled: dto.smsEnabled,
        resendApiKeyEncrypted,
        resendFromName: dto.resendFromName ?? null,
        resendFromEmail,
        resendReceivingAddress,
        resendWebhookSecretEncrypted,
        emailEnabled: dto.emailEnabled,
      },
      update: {
        smsAuthKeyEncrypted,
        smsFlowId,
        smsSenderId: dto.smsSenderId ?? null,
        smsMessageVariable: dto.smsMessageVariable,
        smsWebhookTokenHash,
        smsEnabled: dto.smsEnabled,
        resendApiKeyEncrypted,
        resendFromName: dto.resendFromName ?? null,
        resendFromEmail,
        resendReceivingAddress,
        resendWebhookSecretEncrypted,
        emailEnabled: dto.emailEnabled,
        deletedAt: null,
      },
    });
    return this.settings(businessId);
  }

  async sendSms(businessId: string, destination: string, body: string) {
    const connection = await this.requireConnection(businessId, "SMS");
    const variable = connection.smsMessageVariable || "message";
    const response = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: {
        accept: "application/json",
        authkey: this.decrypt(connection.smsAuthKeyEncrypted!),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        template_id: connection.smsFlowId,
        sender: connection.smsSenderId || undefined,
        recipients: [
          {
            mobiles: this.phoneDigits(destination),
            [variable]: body,
          },
        ],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok || payload.type === "error") {
      throw new BadGatewayException("MSG91 rejected the SMS request");
    }
    return {
      externalMessageId:
        this.stringValue(payload.request_id) ||
        this.stringValue(payload.id) ||
        `sms-${randomBytes(16).toString("hex")}`,
    };
  }

  async sendEmail(
    businessId: string,
    destination: string,
    subject: string,
    body: string,
  ) {
    const connection = await this.requireConnection(businessId, "EMAIL");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.decrypt(connection.resendApiKeyEncrypted!)}`,
        "content-type": "application/json",
        "idempotency-key": randomBytes(16).toString("hex"),
      },
      body: JSON.stringify({
        from: connection.resendFromName
          ? `${connection.resendFromName} <${connection.resendFromEmail}>`
          : connection.resendFromEmail,
        to: [destination],
        subject,
        text: body,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new BadGatewayException("Resend rejected the email request");
    }
    return {
      externalMessageId:
        this.stringValue(payload.id) ||
        `email-${randomBytes(16).toString("hex")}`,
    };
  }

  async receiveSms(
    connectionId: string,
    token: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, smsEnabled: true, deletedAt: null },
    });
    if (!connection?.smsWebhookTokenHash || !token) {
      throw new UnauthorizedException("Invalid SMS webhook token");
    }
    this.assertHash(token, connection.smsWebhookTokenHash);
    const externalId =
      this.pick(payload, ["requestId", "request_id", "messageId", "id"]) ||
      `sms-${this.hash(JSON.stringify(payload))}`;
    const from = this.pick(payload, ["from", "mobile", "sender", "msisdn"]);
    const body = this.pick(payload, ["text", "message", "body"]);
    if (!from || !body) throw new BadRequestException("Invalid SMS webhook");
    await this.storeIncoming(
      connection.businessId,
      "SMS",
      from,
      body,
      null,
      externalId,
    );
    return { received: true };
  }

  async receiveEmail(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    unverifiedPayload: Record<string, unknown>,
  ) {
    const data = this.recordValue(unverifiedPayload.data);
    const to = this.stringArray(data.to);
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        emailEnabled: true,
        deletedAt: null,
        resendReceivingAddress: {
          in: to.map((value) => this.extractEmail(value)),
        },
      },
    });
    if (!connection?.resendWebhookSecretEncrypted) {
      throw new UnauthorizedException("Unknown email destination");
    }
    const webhook = new Webhook(
      this.decrypt(connection.resendWebhookSecretEncrypted),
    );
    let verified: unknown;
    try {
      verified = webhook.verify(rawBody.toString("utf8"), {
        "svix-id": this.header(headers, "svix-id"),
        "svix-timestamp": this.header(headers, "svix-timestamp"),
        "svix-signature": this.header(headers, "svix-signature"),
      });
    } catch {
      throw new UnauthorizedException("Invalid Resend signature");
    }
    const event = this.recordValue(verified);
    if (event.type !== "email.received") return { received: true };
    const verifiedData = this.recordValue(event.data);
    const emailId = this.pick(verifiedData, ["email_id", "id"]);
    if (!emailId) throw new BadRequestException("Missing Resend email ID");
    const email = await this.retrieveEmail(
      this.decrypt(connection.resendApiKeyEncrypted!),
      emailId,
    );
    const from = this.pick(email, ["from"]);
    const subject = this.pick(email, ["subject"]) || "(No subject)";
    const body =
      this.pick(email, ["text"]) || this.stripHtml(this.pick(email, ["html"]));
    if (!from || !body) throw new BadRequestException("Invalid inbound email");
    await this.storeIncoming(
      connection.businessId,
      "EMAIL",
      this.extractEmail(from),
      body,
      subject,
      emailId,
    );
    return { received: true };
  }

  private async retrieveEmail(apiKey: string, emailId: string) {
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
      { headers: { authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) {
      throw new BadGatewayException("Could not retrieve inbound email");
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private async storeIncoming(
    businessId: string,
    channel: IncomingChannel,
    address: string,
    body: string,
    subject: string | null,
    externalMessageId: string,
  ) {
    const duplicate = await this.prisma.message.findFirst({
      where: { businessId, externalMessageId },
      select: { id: true },
    });
    if (duplicate) return;
    const owner = await this.prisma.user.findFirst({
      where: { businessId, role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) throw new NotFoundException("Business owner not found");
    let contact =
      channel === "SMS"
        ? await this.prisma.contact.findFirst({
            where: {
              businessId,
              normalizedPhone: normalizePhone(address),
              deletedAt: null,
            },
            select: { id: true, assignedToId: true },
          })
        : await this.prisma.contact.findFirst({
            where: {
              businessId,
              email: { equals: address, mode: "insensitive" },
              deletedAt: null,
            },
            select: { id: true, assignedToId: true },
          });
    if (!contact) {
      const phone =
        channel === "SMS"
          ? address
          : `9${BigInt(`0x${this.hash(address).slice(0, 14)}`)
              .toString()
              .slice(0, 11)}`;
      contact = await this.prisma.contact.create({
        data: {
          businessId,
          createdById: owner.id,
          assignedToId: owner.id,
          name: channel === "SMS" ? "SMS contact" : address.split("@")[0],
          phone,
          normalizedPhone: normalizePhone(phone),
          email: channel === "EMAIL" ? address : null,
          source: ContactSource.OTHER,
          tags: [channel.toLowerCase()],
        },
        select: { id: true, assignedToId: true },
      });
      await this.prisma.task.create({
        data: {
          businessId,
          title: `Follow up with new ${channel.toLowerCase()} contact`,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          assignedToId: owner.id,
          relatedEntityType: RelatedEntityType.CONTACT,
          relatedEntityId: contact.id,
          source: TaskSource.CONTACT_CREATED,
        },
      });
    }
    const prismaChannel = ConversationChannel[channel];
    const conversation = await this.prisma.conversation.upsert({
      where: {
        businessId_channel_contactId: {
          businessId,
          channel: prismaChannel,
          contactId: contact.id,
        },
      },
      create: {
        businessId,
        channel: prismaChannel,
        contactId: contact.id,
        assignedToId: contact.assignedToId,
        lastMessageAt: new Date(),
        unreadCount: 1,
      },
      update: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        deletedAt: null,
      },
      select: { id: true },
    });
    await this.prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        body,
        subject,
        status: MessageStatus.DELIVERED,
        externalMessageId,
      },
    });
  }

  private async requireConnection(
    businessId: string,
    channel: IncomingChannel,
  ) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { businessId, deletedAt: null },
    });
    if (
      !connection ||
      (channel === "SMS" ? !connection.smsEnabled : !connection.emailEnabled)
    ) {
      throw new BadRequestException(`${channel} is not configured`);
    }
    return connection;
  }

  private emptySettings(): ChannelSettings {
    return {
      sms: {
        configured: false,
        enabled: false,
        flowId: null,
        senderId: null,
        messageVariable: "message",
        webhookConnectionId: null,
      },
      email: {
        configured: false,
        enabled: false,
        fromName: null,
        fromEmail: null,
        receivingAddress: null,
      },
    };
  }

  private encryptionKey(): Buffer {
    const raw =
      this.config.get<string>("COMMUNICATION_CREDENTIALS_KEY") ||
      this.config.get<string>("WHATSAPP_CREDENTIALS_KEY", "");
    if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
      throw new Error(
        "COMMUNICATION_CREDENTIALS_KEY must be a 64-character hexadecimal key",
      );
    }
    return Buffer.from(raw, "hex");
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split(".");
    if (!iv || !tag || !encrypted) throw new Error("Invalid credential");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private assertHash(value: string, expected: string) {
    const actualBuffer = Buffer.from(this.hash(value));
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Invalid SMS webhook token");
    }
  }

  private phoneDigits(value: string) {
    const digits = normalizePhone(value);
    return digits.length === 10 ? `91${digits}` : digits;
  }

  private pick(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = this.stringValue(record[key]);
      if (value) return value;
    }
    return "";
  }

  private stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    return typeof value === "string" ? [value] : [];
  }

  private extractEmail(value: string) {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
  }

  private stripHtml(value: string) {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const value = headers[name];
    return Array.isArray(value) ? value[0] || "" : value || "";
  }
}
