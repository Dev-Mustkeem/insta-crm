import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { PrismaService } from "../../prisma/prisma.service";

const accessCookieExtractor = (request: Request): string | null =>
  request.cookies?.crm_access_token ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new Error("JWT_ACCESS_SECRET is required");

    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromExtractors([
        accessCookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: secret,
    });
  }

  /**
   * Validates token structure and refreshes mutable authorization state from PostgreSQL.
   *
   * @param payload - Verified JWT payload.
   * @returns Current active user identity and role.
   * @throws UnauthorizedException When the token or organization membership is inactive.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type !== "access" || !payload.businessId) {
      throw new UnauthorizedException("Invalid access token");
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        businessId: payload.businessId,
        deletedAt: null,
        business: { deletedAt: null },
      },
      select: { role: true },
    });
    if (!user) throw new UnauthorizedException("Account is no longer active");
    return { ...payload, role: user.role };
  }
}
