import type { Request } from "express";

export interface JwtPayload {
  sub: string;
  businessId: string;
  role: "SUPER_ADMIN" | "OWNER" | "STAFF" | "ACCOUNTANT";
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  businessId?: string;
  cookies: Record<string, string | undefined>;
  user?: JwtPayload;
}
