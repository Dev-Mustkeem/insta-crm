import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ContactSource, ConversationChannel, MessageDirection, MessageStatus, RelatedEntityType, TaskSource } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveGmailOAuthConfigDto } from "./dto/save-gmail-oauth-config.dto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
  headers?: Array<{ name?: string; value?: string }>;
}

interface GmailMessage {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayloadPart;
}

interface GmailConnectionRecord {
  id: string;
  businessId: string;
  emailAddress: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
  lastSyncAt: Date | null;
  enabled: boolean;
}

interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable()
export class GmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async settings(businessId: string) {
    const [connection, owner] = await Promise.all([
      this.prisma.gmailConnection.findFirst({
        where: { businessId, deletedAt: null },
        select: { emailAddress: true, lastSyncAt: true, enabled: true },
      }),
      this.prisma.user.findFirst({
        where: { businessId, role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
        select: { email: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const senderMatchesUser = Boolean(
      owner && connection &&
        owner.email.trim().toLowerCase() === connection.emailAddress.trim().toLowerCase(),
    );
    return {
      oauthConfigured: await this.hasOAuthConfig(businessId),
      configured: Boolean(connection?.enabled && senderMatchesUser),
      emailAddress: connection?.emailAddress ?? null,
      senderEmail: owner?.email ?? null,
      senderMatchesUser,
      lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
      enabled: connection?.enabled ?? false,
    };
  }

  async oauthSettings(businessId: string) {
    const stored = await this.prisma.gmailOAuthConfig.findFirst({
      where: { businessId, deletedAt: null },
      select: { clientIdEncrypted: true, redirectUri: true },
    });
    if (stored) {
      return {
        configured: true,
        clientId: this.decrypt(stored.clientIdEncrypted),
        clientSecretConfigured: true,
        redirectUri: stored.redirectUri,
      };
    }
    const clientId = this.config.get<string>("GMAIL_CLIENT_ID", "").trim();
    const clientSecretConfigured = Boolean(this.config.get<string>("GMAIL_CLIENT_SECRET", "").trim());
    return {
      configured: Boolean(clientId && clientSecretConfigured),
      clientId,
      clientSecretConfigured,
      redirectUri: this.config.get<string>("GMAIL_REDIRECT_URI", "http://localhost:4000/api/gmail/callback"),
    };
  }

  async saveOAuthSettings(businessId: string, dto: SaveGmailOAuthConfigDto) {
    const redirect = new URL(dto.redirectUri);
    if (redirect.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(redirect.hostname)) {
      throw new BadRequestException("The redirect URL must use HTTPS, except for localhost development");
    }
    const existing = await this.prisma.gmailOAuthConfig.findUnique({ where: { businessId } });
    const existingClientId = existing ? this.decrypt(existing.clientIdEncrypted) : "";
    const secret = dto.clientSecret || (
      existing && existingClientId === dto.clientId
        ? this.decrypt(existing.clientSecretEncrypted)
        : this.config.get<string>("GMAIL_CLIENT_ID", "").trim() === dto.clientId
          ? this.config.get<string>("GMAIL_CLIENT_SECRET", "").trim()
          : ""
    );
    if (!secret) throw new BadRequestException("Enter the OAuth client secret before saving this client ID");
    this.encryptionKey();
    await this.prisma.gmailOAuthConfig.upsert({
      where: { businessId },
      create: {
        businessId,
        clientIdEncrypted: this.encrypt(dto.clientId),
        clientSecretEncrypted: this.encrypt(secret),
        redirectUri: redirect.toString(),
        deletedAt: null,
      },
      update: {
        clientIdEncrypted: this.encrypt(dto.clientId),
        clientSecretEncrypted: this.encrypt(secret),
        redirectUri: redirect.toString(),
        deletedAt: null,
      },
    });
    return this.oauthSettings(businessId);
  }

  async authorizationUrl(businessId: string, userId: string) {
    const credentials = await this.oauthCredentials(businessId);
    const state = await this.jwt.signAsync(
      { type: "gmail-oauth", businessId, userId },
      { secret: this.stateSecret(), expiresIn: "10m" },
    );
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", credentials.clientId);
    url.searchParams.set("redirect_uri", credentials.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async completeAuthorization(
    code: string,
    state: string,
    providerError?: string,
  ) {
    const destination = new URL(
      this.config.get<string>("GMAIL_WEB_REDIRECT_URL", "http://localhost:3000/gmail"),
    );
    if (providerError || !code || !state) {
      destination.searchParams.set("gmail", "error");
      return destination.toString();
    }
    let claims: { type?: string; businessId?: string; userId?: string };
    try {
      claims = await this.jwt.verifyAsync(state, { secret: this.stateSecret() });
    } catch {
      throw new BadRequestException("Gmail authorization has expired. Please connect again.");
    }
    if (claims.type !== "gmail-oauth" || !claims.businessId || !claims.userId) {
      throw new BadRequestException("Invalid Gmail authorization state");
    }

    const credentials = await this.oauthCredentials(claims.businessId);
    const token = await this.exchangeCode(code, credentials);
    const prior = await this.prisma.gmailConnection.findFirst({
      where: { businessId: claims.businessId },
    });
    const refreshToken = token.refresh_token
      ? this.encrypt(token.refresh_token)
      : prior?.refreshTokenEncrypted;
    if (!refreshToken) {
      throw new BadRequestException("Google did not provide a refresh token. Disconnect Gmail access in Google Account settings, then connect again.");
    }
    const accessToken = this.encrypt(token.access_token);
    const emailAddress = await this.profileEmail(token.access_token);
    const user = await this.prisma.user.findFirst({
      where: { id: claims.userId, businessId: claims.businessId, deletedAt: null },
      select: { email: true },
    });
    if (!user || user.email.trim().toLowerCase() !== emailAddress) {
      destination.searchParams.set("gmail", "sender-mismatch");
      return destination.toString();
    }
    const expiresAt = new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000);
    await this.prisma.gmailConnection.upsert({
      where: { businessId: claims.businessId },
      create: {
        businessId: claims.businessId,
        emailAddress,
        accessTokenEncrypted: accessToken,
        refreshTokenEncrypted: refreshToken,
        tokenExpiresAt: expiresAt,
        enabled: true,
        deletedAt: null,
      },
      update: {
        emailAddress,
        accessTokenEncrypted: accessToken,
        refreshTokenEncrypted: refreshToken,
        tokenExpiresAt: expiresAt,
        enabled: true,
        deletedAt: null,
      },
    });
    destination.searchParams.set("gmail", "connected");
    return destination.toString();
  }

  async disconnect(businessId: string) {
    await this.prisma.gmailConnection.updateMany({
      where: { businessId, deletedAt: null },
      data: { enabled: false, deletedAt: new Date() },
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
    const connection = await this.requireConnection(businessId);
    const token = await this.validAccessToken(connection);
    const recipients = [...new Set((to.length ? to : [defaultDestination]).map((address) => address.trim().toLowerCase()).filter(Boolean))];
    const copy = [...new Set(cc.map((address) => address.trim().toLowerCase()).filter(Boolean))];
    const blindCopy = [...new Set(bcc.map((address) => address.trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length && !copy.length && !blindCopy.length) throw new BadRequestException("Add at least one email recipient");
    const cleanSubject = subject.replace(/[\r\n]+/g, " ").trim();
    const rawMessage = [
      `From: ${connection.emailAddress}`,
      ...(recipients.length ? [`To: ${recipients.join(", ")}`] : []),
      ...(copy.length ? [`Cc: ${copy.join(", ")}`] : []),
      ...(blindCopy.length ? [`Bcc: ${blindCopy.join(", ")}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(cleanSubject, "utf8").toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trim(),
    ].join("\r\n");
    const result = await this.gmailRequest<{ id?: string }>(token, "/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw: Buffer.from(rawMessage).toString("base64url") }),
    });
    if (!result.id) throw new BadGatewayException("Gmail accepted the send without returning a message ID");
    return { externalMessageId: result.id };
  }
  async sync(businessId: string) {
    const connection = await this.requireConnection(businessId);
    const token = await this.validAccessToken(connection);
    const start = connection.lastSyncAt
      ? Math.floor((connection.lastSyncAt.getTime() - 60_000) / 1000)
      : undefined;
    const query = start ? `after:${start}` : "newer_than:30d";
    let pageToken: string | undefined;
    let scanned = 0;
    let imported = 0;
    do {
      const parameters = new URLSearchParams({ q: query, maxResults: "100" });
      if (pageToken) parameters.set("pageToken", pageToken);
      const page = await this.gmailRequest<{
        messages?: Array<{ id?: string }>;
        nextPageToken?: string;
      }>(token, "/messages?" + parameters.toString());
      for (const item of page.messages ?? []) {
        if (!item.id) continue;
        scanned += 1;
        const message = await this.gmailRequest<GmailMessage>(
          token,
          `/messages/${encodeURIComponent(item.id)}?format=full`,
        );
        if (await this.importMessage(businessId, connection, message)) imported += 1;
      }
      pageToken = page.nextPageToken;
    } while (pageToken && scanned < 500);
    await this.prisma.gmailConnection.updateMany({
      where: { businessId, deletedAt: null },
      data: { lastSyncAt: new Date() },
    });
    return { scanned, imported, syncedAt: new Date().toISOString() };
  }

  private async importMessage(
    businessId: string,
    connection: GmailConnectionRecord,
    message: GmailMessage,
  ) {
    if (!message.id) return false;
    const exists = await this.prisma.message.findFirst({
      where: { businessId, externalMessageId: message.id },
      select: { id: true },
    });
    if (exists) return false;
    const headers = message.payload?.headers ?? [];
    const header = (name: string) =>
      headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
    const from = this.extractAddress(header("From"));
    const to = this.extractAddress(header("To"));
    const ownerAddress = connection.emailAddress.toLowerCase();
    const outbound = from.toLowerCase() === ownerAddress;
    const contactAddress = outbound ? to : from;
    if (!contactAddress || contactAddress.toLowerCase() === ownerAddress) return false;
    const owner = await this.prisma.user.findFirst({
      where: { businessId, role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) return false;
    let contact = await this.prisma.contact.findFirst({
      where: { businessId, email: { equals: contactAddress, mode: "insensitive" }, deletedAt: null },
      select: { id: true, assignedToId: true },
    });
    if (!contact && !outbound) {
      const phone = this.syntheticPhone(contactAddress);
      contact = await this.prisma.contact.create({
        data: {
          businessId,
          createdById: owner.id,
          assignedToId: owner.id,
          name: this.displayName(from) || contactAddress.split("@")[0] || "Gmail contact",
          phone,
          normalizedPhone: phone,
          email: contactAddress,
          source: ContactSource.GMAIL,
          tags: ["gmail"],
        },
        select: { id: true, assignedToId: true },
      });
      await this.prisma.task.create({
        data: {
          businessId,
          title: `Follow up with ${contactAddress}`,
          dueAt: new Date(Date.now() + 86_400_000),
          assignedToId: owner.id,
          relatedEntityType: RelatedEntityType.CONTACT,
          relatedEntityId: contact.id,
          source: TaskSource.CONTACT_CREATED,
        },
      });
    }
    if (!contact) return false;
    const date = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
    const conversation = await this.prisma.conversation.upsert({
      where: {
        businessId_channel_contactId: {
          businessId,
          channel: ConversationChannel.EMAIL,
          contactId: contact.id,
        },
      },
      create: {
        businessId,
        contactId: contact.id,
        channel: ConversationChannel.EMAIL,
        assignedToId: contact.assignedToId,
        lastMessageAt: date,
        unreadCount: outbound ? 0 : 1,
      },
      update: {
        lastMessageAt: date,
        unreadCount: outbound ? undefined : { increment: 1 },
        deletedAt: null,
      },
      select: { id: true },
    });
    await this.prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        direction: outbound ? MessageDirection.OUTBOUND : MessageDirection.INBOUND,
        body: this.messageBody(message) || message.snippet || "(No message text)",
        subject: header("Subject") || null,
        status: outbound ? MessageStatus.SENT : MessageStatus.DELIVERED,
        externalMessageId: message.id,
        sentById: outbound ? owner.id : null,
        ...(outbound ? {} : { deliveredAt: date }),
        createdAt: date,
      },
    });
    return true;
  }

  private async requireConnection(businessId: string): Promise<GmailConnectionRecord> {
    const connection = await this.prisma.gmailConnection.findFirst({
      where: { businessId, enabled: true, deletedAt: null },
    });
    if (!connection) throw new BadRequestException("Connect a Gmail account to use the Gmail conversation space");
    const owner = await this.prisma.user.findFirst({
      where: { businessId, role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    if (!owner || owner.email.trim().toLowerCase() !== connection.emailAddress.trim().toLowerCase()) {
      throw new BadRequestException("Reconnect Gmail using the same email address as the CRM owner account");
    }
    return connection;
  }

  private async validAccessToken(connection: GmailConnectionRecord) {
    if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
      return this.decrypt(connection.accessTokenEncrypted);
    }
    const credentials = await this.oauthCredentials(connection.businessId);
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: this.decrypt(connection.refreshTokenEncrypted),
      grant_type: "refresh_token",
    });
    const token = await this.postToken(body);
    const expiresAt = new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000);
    await this.prisma.gmailConnection.update({
      where: { businessId: connection.businessId },
      data: {
        accessTokenEncrypted: this.encrypt(token.access_token),
        tokenExpiresAt: expiresAt,
      },
    });
    return token.access_token;
  }

  private async exchangeCode(code: string, credentials: OAuthCredentials) {
    return this.postToken(new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: credentials.redirectUri,
      grant_type: "authorization_code",
    }));
  }

  private async postToken(body: URLSearchParams) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    }).catch(() => { throw new BadGatewayException("Unable to reach Google OAuth"); });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof payload.access_token !== "string") {
      throw new BadGatewayException("Google OAuth rejected the Gmail connection");
    }
    return {
      access_token: payload.access_token,
      refresh_token: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
      expires_in: typeof payload.expires_in === "number" ? payload.expires_in : 3600,
    };
  }

  private async profileEmail(token: string) {
    const profile = await this.gmailRequest<{ emailAddress?: string }>(token, "/profile");
    const email = profile.emailAddress?.trim().toLowerCase();
    if (!email) throw new BadGatewayException("Google did not return the connected Gmail address");
    return email;
  }

  private async gmailRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(GMAIL_API_URL + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => { throw new BadGatewayException("Unable to reach the Gmail API"); });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      if (response.status === 401) throw new BadGatewayException("Gmail authorization expired. Reconnect the Gmail account.");
      throw new BadGatewayException(`Gmail API request failed (HTTP ${response.status})`);
    }
    return payload as T;
  }

  private messageBody(message: GmailMessage): string {
    const walk = (part?: GmailPayloadPart): string | null => {
      if (!part) return null;
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      }
      for (const child of part.parts ?? []) {
        const text = walk(child);
        if (text) return text;
      }
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/\s+/g, " ")
          .trim();
      }
      return null;
    };
    return walk(message.payload)?.trim() ?? "";
  }

  private extractAddress(value: string) {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] ?? value).trim().toLowerCase();
  }

  private displayName(value: string) {
    return value.match(/^\s*([^<]+?)\s*</)?.[1]?.replace(/^"|"$/g, "").trim() ?? "";
  }

  private syntheticPhone(email: string) {
    const digits = BigInt(`0x${createHash("sha256").update(email).digest("hex").slice(0, 14)}`)
      .toString()
      .padStart(14, "0")
      .slice(0, 14);
    return `9${digits.slice(0, 10)}`;
  }

  private async oauthCredentials(businessId: string): Promise<OAuthCredentials> {
    const stored = await this.prisma.gmailOAuthConfig.findFirst({
      where: { businessId, deletedAt: null },
      select: { clientIdEncrypted: true, clientSecretEncrypted: true, redirectUri: true },
    });
    const credentials = stored
      ? {
          clientId: this.decrypt(stored.clientIdEncrypted),
          clientSecret: this.decrypt(stored.clientSecretEncrypted),
          redirectUri: stored.redirectUri,
        }
      : {
          clientId: this.config.get<string>("GMAIL_CLIENT_ID", "").trim(),
          clientSecret: this.config.get<string>("GMAIL_CLIENT_SECRET", "").trim(),
          redirectUri: this.config.get<string>("GMAIL_REDIRECT_URI", "http://localhost:4000/api/gmail/callback"),
        };
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new ServiceUnavailableException("Add your Google OAuth client ID and secret in Gmail settings first");
    }
    if (!this.config.get<string>("COMMUNICATION_CREDENTIALS_KEY") && !this.config.get<string>("WHATSAPP_CREDENTIALS_KEY")) {
      throw new ServiceUnavailableException("Set COMMUNICATION_CREDENTIALS_KEY to encrypt Gmail credentials");
    }
    this.encryptionKey();
    return credentials;
  }
  private stateSecret() { return this.config.get<string>("JWT_ACCESS_SECRET", ""); }
  private async hasOAuthConfig(businessId: string) {
    try { await this.oauthCredentials(businessId); return true; } catch { return false; }
  }

  private encryptionKey() {
    const key = this.config.get<string>("COMMUNICATION_CREDENTIALS_KEY") || this.config.get<string>("WHATSAPP_CREDENTIALS_KEY", "");
    if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error("COMMUNICATION_CREDENTIALS_KEY must be a 64-character hexadecimal key");
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
    if (!iv || !tag || !encrypted) throw new Error("Stored Gmail credential is invalid");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  }
}
