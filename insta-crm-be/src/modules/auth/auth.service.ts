import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Business, User, UserPagePermission } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { AuthResponse } from "@insta-crm/shared-types";
import * as bcrypt from "bcrypt";
import {
  createHmac,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { resolvePagePermissions } from "../../common/permissions/page-permissions";
import { DEFAULT_PIPELINE_STAGES } from "../pipeline/pipeline.constants";
import type { LoginDto } from "./dto/login.dto";
import type { SignupDto } from "./dto/signup.dto";

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;
type UserWithBusiness = User & {
  business: Business;
  pagePermissions?: UserPagePermission[];
};

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly config: ConfigService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.config = config;
    const accessSecret = config.get<string>("JWT_ACCESS_SECRET");
    const refreshSecret = config.get<string>("JWT_REFRESH_SECRET");
    if (!accessSecret || !refreshSecret) {
      throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required");
    }
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
  }

  async signup(dto: SignupDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user: UserWithBusiness;

    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const business = await transaction.business.create({
          data: { name: dto.businessName.trim() },
        });
        await transaction.pipelineStage.createMany({
          data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
            businessId: business.id,
            ...stage,
          })),
        });
        return transaction.user.create({
          data: {
            businessId: business.id,
            email: dto.email,
            name: dto.ownerName.trim(),
            passwordHash,
            phone: dto.phone.trim(),
            role: "SUPER_ADMIN",
          },
          include: { business: true },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "An account with this email already exists",
        );
      }
      throw error;
    }

    return this.createSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
        business: { deletedAt: null },
      },
      include: { business: true, pagePermissions: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return this.createSession(user);
  }

  async refresh(rawRefreshToken: string) {
    const payload = await this.verifyRefreshToken(rawRefreshToken);
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        businessId: payload.businessId,
        deletedAt: null,
        business: { deletedAt: null },
      },
      include: { business: true, pagePermissions: true },
    });

    if (
      !user?.refreshTokenHash ||
      !this.refreshTokenMatches(rawRefreshToken, user.refreshTokenHash)
    ) {
      throw new UnauthorizedException("Refresh token is no longer valid");
    }
    return this.createSession(user);
  }

  async logout(rawRefreshToken?: string) {
    if (!rawRefreshToken) return;
    try {
      const payload = await this.verifyRefreshToken(rawRefreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { refreshTokenHash: true },
      });
      if (
        user?.refreshTokenHash &&
        this.refreshTokenMatches(rawRefreshToken, user.refreshTokenHash)
      ) {
        await this.prisma.user.update({
          where: { id: payload.sub },
          data: { refreshTokenHash: null },
        });
      }
    } catch {
      // Cookies are still cleared for expired or invalid tokens.
    }
  }

  async getSession(userId: string, businessId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId, deletedAt: null },
      include: { business: true, pagePermissions: true },
    });
    if (!user || user.business.deletedAt) {
      throw new UnauthorizedException("Session is no longer valid");
    }
    return this.toPublicSession(user);
  }

  async createEvidenceVaultLaunchUrl(
    userId: string,
    businessId: string,
    state: string,
  ) {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(state ?? "")) {
      throw new UnauthorizedException("Invalid document-search launch state");
    }
    const callback = this.config.get<string>("EVIDENCE_VAULT_CALLBACK_URL");
    if (!callback) {
      throw new ServiceUnavailableException(
        "Document search sign-in is not configured",
      );
    }
    const destination = new URL(callback);
    if (
      destination.protocol !== "https:" &&
      process.env.NODE_ENV === "production"
    ) {
      throw new ServiceUnavailableException(
        "Document search callback must use HTTPS",
      );
    }

    const session = await this.getSession(userId, businessId);
    const localSsoEnabled =
      process.env.NODE_ENV !== "production" &&
      this.config.get<string>("EVIDENCE_VAULT_LOCAL_SSO_ENABLED") === "true";
    let code: string;
    if (localSsoEnabled) {
      code = this.createLocalEvidenceVaultCode({
        subject: userId,
        email: session.user.email,
        name: session.user.name,
      }, state);
    } else {
      code = randomBytes(32).toString("base64url");
      const now = new Date();
      const codeHash = this.hashRefreshToken(code);
      await this.prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          DELETE FROM evidence_vault_sso_codes WHERE expires_at <= ${now}
        `;
        await transaction.$executeRaw`
          INSERT INTO evidence_vault_sso_codes (code_hash, user_id, expires_at)
          VALUES (${codeHash}, ${userId}::uuid, ${new Date(now.getTime() + 60_000)})
        `;
      });
    }
    destination.searchParams.set("code", code);
    destination.searchParams.set("state", state);
    return destination.toString();
  }

  private createLocalEvidenceVaultCode(identity: {
    subject: string;
    email: string;
    name: string;
  }, state: string) {
    const secret = this.config.get<string>("EVIDENCE_VAULT_SHARED_SECRET", "").trim();
    if (secret.length < 32) {
      throw new ServiceUnavailableException(
        "Local document search sign-in is not configured",
      );
    }
    const payload = Buffer.from(
      JSON.stringify({
        ...identity,
        state,
        exp: Math.floor(Date.now() / 1000) + 60,
        jti: randomBytes(24).toString("base64url"),
      }),
      "utf8",
    ).toString("base64url");
    const unsignedCode = `local.${payload}`;
    const signature = createHmac("sha256", secret)
      .update(unsignedCode)
      .digest("base64url");
    return `${unsignedCode}.${signature}`;
  }

  async redeemEvidenceVaultCode(code: string, authorization?: string) {
    const expectedSecret = this.config
      .get<string>("EVIDENCE_VAULT_SHARED_SECRET", "")
      .trim();
    const suppliedSecret = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    if (
      !expectedSecret ||
      !suppliedSecret ||
      Buffer.byteLength(expectedSecret) !== Buffer.byteLength(suppliedSecret) ||
      !timingSafeEqual(Buffer.from(expectedSecret), Buffer.from(suppliedSecret))
    ) {
      throw new UnauthorizedException("Invalid document-search integration credentials");
    }

    if (code?.startsWith("local.")) {
      const parts = code.split(".");
      if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
        throw new UnauthorizedException("Invalid or expired document-search code");
      }
      const unsignedCode = `${parts[0]}.${parts[1]}`;
      const expectedSignature = createHmac("sha256", expectedSecret)
        .update(unsignedCode)
        .digest();
      let suppliedSignature: Buffer;
      try {
        suppliedSignature = Buffer.from(parts[2], "base64url");
      } catch {
        throw new UnauthorizedException("Invalid or expired document-search code");
      }
      if (
        suppliedSignature.length !== expectedSignature.length ||
        !timingSafeEqual(expectedSignature, suppliedSignature)
      ) {
        throw new UnauthorizedException("Invalid or expired document-search code");
      }

      let identity: { subject?: unknown; exp?: unknown };
      try {
        identity = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      } catch {
        throw new UnauthorizedException("Invalid or expired document-search code");
      }
      if (
        typeof identity.subject !== "string" ||
        typeof identity.exp !== "number" ||
        identity.exp <= Math.floor(Date.now() / 1000)
      ) {
        throw new UnauthorizedException("Invalid or expired document-search code");
      }
      const user = await this.prisma.user.findFirst({
        where: {
          id: identity.subject,
          deletedAt: null,
          business: { deletedAt: null },
        },
        select: { id: true, email: true, name: true },
      });
      if (!user) throw new UnauthorizedException("CRM account is no longer active");
      return { subject: user.id, email: user.email, name: user.name };
    }

    if (!/^[A-Za-z0-9_-]{40,50}$/.test(code ?? "")) {
      throw new UnauthorizedException("Invalid or expired document-search code");
    }

    const codeHash = this.hashRefreshToken(code);
    return this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      const consumed = await transaction.$queryRaw<Array<{ userId: string }>>`
        DELETE FROM evidence_vault_sso_codes
        WHERE code_hash = ${codeHash} AND expires_at > ${now}
        RETURNING user_id AS "userId"
      `;
      if (consumed.length !== 1) {
        throw new UnauthorizedException("Invalid or expired document-search code");
      }
      const users = await transaction.$queryRaw<
        Array<{ id: string; email: string; name: string }>
      >`
        SELECT u.id, u.email, u.name
        FROM users u
        INNER JOIN businesses b ON b.id = u.business_id
        WHERE u.id = ${consumed[0].userId}::uuid
          AND u.deleted_at IS NULL AND b.deleted_at IS NULL
      `;
      const user = users[0];
      if (!user) throw new UnauthorizedException("CRM account is no longer active");
      return { subject: user.id, email: user.email, name: user.name };
    });
  }

  private async createSession(user: UserWithBusiness) {
    const payload = {
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...payload, type: "access", jti: randomUUID() },
        { secret: this.accessSecret, expiresIn: ACCESS_TOKEN_SECONDS },
      ),
      this.jwt.signAsync(
        { ...payload, type: "refresh", jti: randomUUID() },
        { secret: this.refreshSecret, expiresIn: REFRESH_TOKEN_SECONDS },
      ),
    ]);
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      response: {
        ...this.toPublicSession(user),
        accessToken,
        expiresIn: ACCESS_TOKEN_SECONDS,
      } satisfies AuthResponse,
      accessToken,
      refreshToken,
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecret,
      });
      if (payload.type !== "refresh" || !payload.businessId) throw new Error();
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshTokenMatches(token: string, storedHash: string): boolean {
    const candidateHash = this.hashRefreshToken(token);
    if (candidateHash.length !== storedHash.length) return false;
    return timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(storedHash, "hex"),
    );
  }

  private toPublicSession(
    user: UserWithBusiness & {
      pagePermissions?: Array<{ page: string; access: string }>;
    },
  ) {
    return {
      user: {
        id: user.id,
        businessId: user.businessId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        permissions: resolvePagePermissions(user.role, user.pagePermissions ?? []),
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        businessType: user.business.businessType,
        teamSize: user.business.teamSize,
        onboardingCompletedAt:
          user.business.onboardingCompletedAt?.toISOString() ?? null,
        inventoryEnabled: user.business.inventoryEnabled,
      },
    };
  }
}
