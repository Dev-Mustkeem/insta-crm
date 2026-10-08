import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";

type SystemEmailCredentials = {
  senderEmail: string;
  host: string;
  port: number;
  security: "SSL_TLS" | "STARTTLS";
  username: string;
  password: string;
};

/** Sends application-owned messages such as invitations and operational notifications. */
@Injectable()
export class SystemEmailService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Sends a backend-owned email using the application SMTP account.
   *
   * @param destination - Primary recipient address.
   * @param subject - Message subject.
   * @param body - Plain-text message body.
   * @throws ServiceUnavailableException When system SMTP settings are incomplete.
   * @throws BadGatewayException When the SMTP provider rejects the message.
   */
  async send(destination: string, subject: string, body: string) {
    const credentials = this.credentials();
    try {
      const result = await this.transport(credentials).sendMail({
        from: credentials.senderEmail,
        to: destination,
        subject: subject.replace(/[\r\n]+/g, " ").trim(),
        text: body,
      });
      if (!result.messageId) throw new Error("SMTP server did not return a message ID");
      return { externalMessageId: result.messageId };
    } catch (error) {
      throw new BadGatewayException(this.errorMessage(error));
    }
  }

  /** Reads private application SMTP settings without exposing them to organization users. */
  private credentials(): SystemEmailCredentials {
    const senderEmail = this.value("SYSTEM_SMTP_SENDER_EMAIL", "SMTP_SENDER_EMAIL").trim().toLowerCase();
    const host = this.value("SYSTEM_SMTP_HOST", "SMTP_HOST").trim();
    const username = this.value("SYSTEM_SMTP_USERNAME", "SMTP_USERNAME").trim();
    const password = this.value("SYSTEM_SMTP_PASSWORD", "SMTP_PASSWORD").trim();
    const port = Number(this.value("SYSTEM_SMTP_PORT", "SMTP_PORT", "587"));
    const security = this.value("SYSTEM_SMTP_SECURITY", "SMTP_SECURITY", "STARTTLS");
    if (!senderEmail || !host || !username || !password || !Number.isInteger(port) || port < 1 || port > 65535 || !["SSL_TLS", "STARTTLS"].includes(security)) {
      throw new ServiceUnavailableException("Backend email delivery is not configured");
    }
    return { senderEmail, host, port, security: security as SystemEmailCredentials["security"], username, password: this.normalizePassword(host, password) };
  }

  /** Resolves a system-only setting, retaining legacy SMTP names for deployment compatibility. */
  private value(primary: string, legacy: string, fallback = "") {
    return this.config.get<string>(primary) ?? this.config.get<string>(legacy) ?? fallback;
  }

  /** Creates a transport for the backend SMTP account. */
  private transport(credentials: SystemEmailCredentials): Transporter {
    return nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.security === "SSL_TLS",
      requireTLS: credentials.security === "STARTTLS",
      auth: { user: credentials.username, pass: credentials.password },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  /** Maps provider errors to a safe message for API consumers. */
  private errorMessage(error: unknown) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "EAUTH") return "Backend email authentication failed";
    if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ECONNREFUSED" || code === "ENOTFOUND") return "Backend email server is unavailable";
    return "Backend email delivery failed";
  }

  /** Removes spaces from Gmail app passwords while preserving other providers unchanged. */
  private normalizePassword(host: string, password: string) {
    return host.trim().toLowerCase() === "smtp.gmail.com" ? password.replace(/\s+/g, "") : password;
  }
}
