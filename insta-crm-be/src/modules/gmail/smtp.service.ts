import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveSmtpConfigDto } from "./dto/save-smtp-config.dto";

type SmtpCredentials = {
  senderEmail: string;
  host: string;
  port: number;
  security: "SSL_TLS" | "STARTTLS";
  username: string;
  password: string;
};

@Injectable()
export class SmtpService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async settings(businessId: string) {
    const config = await this.prisma.smtpConfig.findFirst({ where: { businessId, deletedAt: null } });
    return {
      configured: Boolean(config),
      senderEmail: config?.senderEmail ?? "",
      host: config?.host ?? "",
      port: config?.port ?? 587,
      security: (config?.security ?? "STARTTLS") as "SSL_TLS" | "STARTTLS",
      username: config?.username ?? "",
      passwordConfigured: Boolean(config?.passwordEncrypted),
    };
  }

  async saveSettings(businessId: string, dto: SaveSmtpConfigDto) {
    const existing = await this.prisma.smtpConfig.findUnique({ where: { businessId } });
    const submittedPassword = dto.password
      ? this.normalizePassword(dto.host, dto.password)
      : "";
    const password = submittedPassword ||
      (existing && existing.host === dto.host && existing.username === dto.username
        ? this.decrypt(existing.passwordEncrypted)
          : "");
    if (!password) throw new BadRequestException("Enter the SMTP password or app password for this account");
    const credentials: SmtpCredentials = { ...dto, password };
    try {
      await this.createTransport(credentials).verify();
    } catch (error) {
      throw new BadGatewayException(this.smtpError(error));
    }
    await this.prisma.smtpConfig.upsert({
      where: { businessId },
      create: {
        businessId,
        senderEmail: dto.senderEmail,
        host: dto.host,
        port: dto.port,
        security: dto.security,
        username: dto.username,
        passwordEncrypted: this.encrypt(password),
        deletedAt: null,
      },
      update: {
        senderEmail: dto.senderEmail,
        host: dto.host,
        port: dto.port,
        security: dto.security,
        username: dto.username,
        passwordEncrypted: this.encrypt(password),
        deletedAt: null,
      },
    });
    return { ...(await this.settings(businessId)), testSucceeded: true };
  }

  async disconnect(businessId: string) {
    await this.prisma.smtpConfig.updateMany({
      where: { businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async sendEmail(
    businessId: string,
    defaultDestination: string,
    subject: string,
    body: string,
    to: string[] = [],
    cc: string[] = [],
    bcc: string[] = [],
  ) {
    const credentials = await this.credentials(businessId);
    const recipients = this.uniqueAddresses(to.length ? to : [defaultDestination]);
    const copy = this.uniqueAddresses(cc);
    const blindCopy = this.uniqueAddresses(bcc);
    if (!recipients.length && !copy.length && !blindCopy.length) throw new BadRequestException("Add at least one email recipient");
    try {
      const result = await this.createTransport(credentials).sendMail({
        from: credentials.senderEmail,
        to: recipients,
        cc: copy.length ? copy : undefined,
        bcc: blindCopy.length ? blindCopy : undefined,
        subject: subject.replace(/[\r\n]+/g, " ").trim(),
        text: body,
      });
      if (!result.messageId) throw new Error("SMTP server did not return a message ID");
      return { externalMessageId: result.messageId };
    } catch (error) {
      throw new BadGatewayException(this.smtpError(error));
    }
  }

  private async credentials(businessId: string): Promise<SmtpCredentials> {
    const saved = await this.prisma.smtpConfig.findFirst({ where: { businessId, deletedAt: null } });
    if (saved) {
      return {
        senderEmail: saved.senderEmail,
        host: saved.host,
        port: saved.port,
        security: saved.security as SmtpCredentials["security"],
        username: saved.username,
        password: this.decrypt(saved.passwordEncrypted),
      };
    }
    throw new ServiceUnavailableException("Configure and test your SMTP sender in Email settings first");
  }

  private createTransport(credentials: SmtpCredentials): Transporter {
    return nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.security === "SSL_TLS",
      requireTLS: credentials.security === "STARTTLS",
      auth: {
        user: credentials.username,
        pass: this.normalizePassword(credentials.host, credentials.password),
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  private uniqueAddresses(addresses: string[]) {
    return [...new Set(addresses.map((address) => address.trim().toLowerCase()).filter(Boolean))];
  }

  private smtpError(error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const responseCode = error && typeof error === "object" && "responseCode" in error ? Number(error.responseCode) : 0;
    if (code === "EAUTH" || responseCode === 535 || responseCode === 534) return "SMTP authentication failed. Check the username and email app password.";
    if (code === "EENVELOPE" || responseCode === 550 || responseCode === 553) return "The SMTP server rejected the sender address. For Gmail, use the authenticated account or a verified Send mail as alias.";
    if (code === "ETLS" || responseCode === 530 || responseCode === 538) return "SMTP security negotiation failed. Use STARTTLS on port 587 or SSL/TLS on port 465, as required by your provider.";
    if (code.includes("TIMEOUT")) return "The SMTP server timed out. Check the host, port, and connection security.";
    if (code === "ECONNECTION" || code === "ECONNREFUSED" || code === "ENOTFOUND") return "Could not reach the SMTP server. Check the host, port, and connection security.";
    return "The SMTP server rejected the connection. Check the SMTP settings and try again.";
  }

  private normalizePassword(host: string, password: string) {
    return host.trim().toLowerCase() === "smtp.gmail.com"
      ? password.replace(/\s+/g, "")
      : password;
  }

  private encryptionKey() {
    const key = this.config.get<string>("COMMUNICATION_CREDENTIALS_KEY") || this.config.get<string>("WHATSAPP_CREDENTIALS_KEY", "");
    if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new ServiceUnavailableException("Credential encryption is not configured on the API");
    return Buffer.from(key, "hex");
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split(".");
    if (!iv || !tag || !encrypted) throw new ServiceUnavailableException("Stored SMTP credentials are invalid");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  }
}
