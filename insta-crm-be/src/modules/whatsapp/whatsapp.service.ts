import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type {
  WhatsAppSettings,
  WhatsAppTemplateSummary,
} from "@insta-crm/shared-types";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateWhatsAppSettingsDto } from "./dto/update-whatsapp-settings.dto";

const DIALOG360_BASE_URL = "https://waba-v2.360dialog.io";

interface ProviderConnection {
  id: string;
  businessId: string;
  apiKeyEncrypted: string;
  reminderTemplateName: string | null;
  reminderTemplateLanguage: string;
  digestTemplateName?: string | null;
  digestTemplateLanguage?: string;
  enabled: boolean;
}

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async settings(businessId: string): Promise<WhatsAppSettings> {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { businessId, deletedAt: null },
    });
    if (!connection) {
      return {
        configured: false,
        provider: "360dialog",
        phoneNumberId: null,
        displayPhoneNumber: null,
        reminderTemplateName: null,
        reminderTemplateLanguage: "en_US",
        digestTemplateName: null,
        digestTemplateLanguage: "en_US",
        enabled: false,
      };
    }
    return this.toSettings(connection);
  }

  async configure(businessId: string, dto: UpdateWhatsAppSettingsDto) {
    const existing = await this.prisma.whatsAppConnection.findFirst({
      where: { businessId, deletedAt: null },
    });
    if (!existing && !dto.apiKey) {
      throw new BadRequestException("A 360dialog API key is required");
    }
    const apiKeyEncrypted = dto.apiKey
      ? this.encrypt(dto.apiKey.trim())
      : existing?.apiKeyEncrypted;
    if (!apiKeyEncrypted) {
      throw new BadRequestException("A 360dialog API key is required");
    }

    try {
      const connection = await this.prisma.whatsAppConnection.upsert({
        where: { businessId },
        create: {
          businessId,
          phoneNumberId: dto.phoneNumberId,
          displayPhoneNumber: dto.displayPhoneNumber,
          apiKeyEncrypted,
          reminderTemplateName: dto.reminderTemplateName || null,
          reminderTemplateLanguage: dto.reminderTemplateLanguage,
          digestTemplateName: dto.digestTemplateName || null,
          digestTemplateLanguage: dto.digestTemplateLanguage,
          enabled: dto.enabled,
        },
        update: {
          phoneNumberId: dto.phoneNumberId,
          displayPhoneNumber: dto.displayPhoneNumber,
          apiKeyEncrypted,
          reminderTemplateName: dto.reminderTemplateName || null,
          reminderTemplateLanguage: dto.reminderTemplateLanguage,
          digestTemplateName: dto.digestTemplateName || null,
          digestTemplateLanguage: dto.digestTemplateLanguage,
          enabled: dto.enabled,
          deletedAt: null,
        },
      });
      return this.toSettings(connection);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "This 360dialog phone number is already connected",
        );
      }
      throw error;
    }
  }

  async templates(businessId: string): Promise<WhatsAppTemplateSummary[]> {
    const connection = await this.requireConnection(businessId);
    const payload = await this.request(connection, "/v1/configs/templates", {
      method: "GET",
    });
    const candidates = this.arrayProperty(payload, [
      "waba_templates",
      "data",
      "templates",
    ]);
    return candidates
      .map((item) => this.toTemplate(item))
      .filter((item): item is WhatsAppTemplateSummary => Boolean(item))
      .filter((item) => item.status.toUpperCase() === "APPROVED")
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async sendText(businessId: string, destination: string, body: string) {
    const connection = await this.requireConnection(businessId);
    return this.send(connection, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.destination(destination),
      type: "text",
      text: { body },
    });
  }

  async sendTemplate(
    businessId: string,
    destination: string,
    name: string,
    language: string,
    parameters: string[],
  ) {
    const connection = await this.requireConnection(businessId);
    return this.sendTemplateWithConnection(
      connection,
      destination,
      name,
      language,
      parameters,
    );
  }

  async sendTaskReminder(data: {
    businessId: string;
    taskId: string;
    taskTitle: string;
    dueAt: string;
    assignedTo: { id: string; name: string; phone: string };
  }) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { businessId: data.businessId, enabled: true, deletedAt: null },
      select: {
        id: true,
        businessId: true,
        apiKeyEncrypted: true,
        reminderTemplateName: true,
        reminderTemplateLanguage: true,
        enabled: true,
      },
    });
    if (!connection?.reminderTemplateName) {
      return { status: "skipped", reason: "reminder-template-not-configured" };
    }
    const due = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(data.dueAt));
    const result = await this.sendTemplateWithConnection(
      connection,
      data.assignedTo.phone,
      connection.reminderTemplateName,
      connection.reminderTemplateLanguage,
      [data.taskTitle, due],
    );
    return { status: "sent", taskId: data.taskId, ...result };
  }

  async sendOwnerDigest(data: {
    businessId: string;
    message: string;
    frequency: "daily" | "weekly";
  }) {
    const [connection, owner] = await Promise.all([
      this.prisma.whatsAppConnection.findFirst({
        where: { businessId: data.businessId, enabled: true, deletedAt: null },
        select: {
          id: true,
          businessId: true,
          apiKeyEncrypted: true,
          reminderTemplateName: true,
          reminderTemplateLanguage: true,
          digestTemplateName: true,
          digestTemplateLanguage: true,
          enabled: true,
        },
      }),
      this.prisma.user.findFirst({
        where: {
          businessId: data.businessId,
          role: { in: ["SUPER_ADMIN", "OWNER"] },
          deletedAt: null,
        },
        select: { id: true, phone: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!connection?.digestTemplateName) {
      return { status: "skipped", reason: "digest-template-not-configured" };
    }
    if (!owner) return { status: "skipped", reason: "owner-not-found" };
    const result = await this.sendTemplateWithConnection(
      connection,
      owner.phone,
      connection.digestTemplateName,
      connection.digestTemplateLanguage,
      [data.message],
    );
    return {
      status: "sent",
      ownerId: owner.id,
      frequency: data.frequency,
      ...result,
    };
  }

  private async requireConnection(
    businessId: string,
  ): Promise<ProviderConnection> {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { businessId, enabled: true, deletedAt: null },
      select: {
        id: true,
        businessId: true,
        apiKeyEncrypted: true,
        reminderTemplateName: true,
        reminderTemplateLanguage: true,
        digestTemplateName: true,
        digestTemplateLanguage: true,
        enabled: true,
      },
    });
    if (!connection) {
      throw new NotFoundException(
        "Configure and enable the 360dialog connection first",
      );
    }
    return connection;
  }

  private async sendTemplateWithConnection(
    connection: ProviderConnection,
    destination: string,
    name: string,
    language: string,
    parameters: string[],
  ) {
    return this.send(connection, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.destination(destination),
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(parameters.length
          ? {
              components: [
                {
                  type: "body",
                  parameters: parameters.map((text) => ({
                    type: "text",
                    text,
                  })),
                },
              ],
            }
          : {}),
      },
    });
  }

  private async send(
    connection: ProviderConnection,
    body: Record<string, unknown>,
  ) {
    const payload = await this.request(connection, "/messages", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const id = this.firstMessageId(payload);
    if (!id) {
      throw new BadGatewayException(
        "360dialog accepted the request without a message ID",
      );
    }
    return { externalMessageId: id };
  }

  private async request(
    connection: ProviderConnection,
    path: string,
    init: RequestInit,
  ): Promise<unknown> {
    const response = await fetch(DIALOG360_BASE_URL + path, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "D360-API-KEY": this.decrypt(connection.apiKeyEncrypted),
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw new BadGatewayException("Unable to reach 360dialog");
    });
    const text = await response.text();
    let payload: unknown = {};
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { raw: text };
      }
    }
    if (!response.ok) {
      throw new BadGatewayException(
        "360dialog rejected the request (HTTP " + response.status + ")",
      );
    }
    return payload;
  }

  private encryptionKey(): Buffer {
    const raw = this.config.get<string>("WHATSAPP_CREDENTIALS_KEY", "");
    if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
      throw new Error(
        "WHATSAPP_CREDENTIALS_KEY must be a 64-character hexadecimal key",
      );
    }
    return Buffer.from(raw, "hex");
  }

  private encrypt(value: string): string {
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

  private decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      throw new Error("Stored WhatsApp credential is invalid");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private destination(value: string): string {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      throw new BadRequestException("Destination phone number is invalid");
    }
    return digits;
  }

  private firstMessageId(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const messages = (payload as { messages?: unknown }).messages;
    if (!Array.isArray(messages) || !messages.length) return null;
    const first = messages[0];
    if (!first || typeof first !== "object") return null;
    const id = (first as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  private arrayProperty(payload: unknown, keys: string[]): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  private toTemplate(value: unknown): WhatsAppTemplateSummary | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name : null;
    if (!name) return null;
    const components = Array.isArray(item.components) ? item.components : [];
    const bodyComponent = components.find(
      (component) =>
        component &&
        typeof component === "object" &&
        String((component as Record<string, unknown>).type).toUpperCase() ===
          "BODY",
    ) as Record<string, unknown> | undefined;
    const body =
      typeof bodyComponent?.text === "string" ? bodyComponent.text : "";
    const parameterNumbers = body.match(/{{\s*\d+\s*}}/g) ?? [];
    return {
      id: typeof item.id === "string" ? item.id : name,
      name,
      language:
        typeof item.language === "string"
          ? item.language
          : typeof item.language_code === "string"
            ? item.language_code
            : "en_US",
      category: typeof item.category === "string" ? item.category : "UTILITY",
      status: typeof item.status === "string" ? item.status : "UNKNOWN",
      body,
      parameterCount: parameterNumbers.length,
    };
  }

  private toSettings(connection: {
    phoneNumberId: string;
    displayPhoneNumber: string;
    reminderTemplateName: string | null;
    reminderTemplateLanguage: string;
    digestTemplateName: string | null;
    digestTemplateLanguage: string;
    enabled: boolean;
  }): WhatsAppSettings {
    return {
      configured: true,
      provider: "360dialog",
      phoneNumberId: connection.phoneNumberId,
      displayPhoneNumber: connection.displayPhoneNumber,
      reminderTemplateName: connection.reminderTemplateName,
      reminderTemplateLanguage: connection.reminderTemplateLanguage,
      digestTemplateName: connection.digestTemplateName,
      digestTemplateLanguage: connection.digestTemplateLanguage,
      enabled: connection.enabled,
    };
  }
}
