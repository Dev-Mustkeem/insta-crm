import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { SignupDto } from "./dto/signup.dto";

const ACCESS_COOKIE_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("signup")
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.signup(dto);
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(dto);
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.crm_refresh_token ?? dto.refreshToken;
    if (!token) throw new BadRequestException("Refresh token is required");
    const session = await this.auth.refresh(token);
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return session.response;
  }

  @Public()
  @Post("logout")
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.crm_refresh_token ?? dto.refreshToken;
    await this.auth.logout(token);
    response.clearCookie("crm_access_token", { path: "/" });
    response.clearCookie("crm_refresh_token", { path: "/api/auth" });
    return { success: true };
  }

  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.getSession(user.sub, user.businessId);
  }

  @Get("evidence-vault/launch")
  @PageAccess("EVIDENCE_VAULT")
  async launchEvidenceVault(
    @CurrentUser() user: JwtPayload,
    @Query("state") state: string,
    @Res() response: Response,
  ) {
    const destination = await this.auth.createEvidenceVaultLaunchUrl(
      user.sub,
      user.businessId,
      state,
    );
    response.setHeader("Cache-Control", "no-store");
    return response.redirect(302, destination);
  }

  @Public()
  @HttpCode(200)
  @Post("evidence-vault/exchange")
  exchangeEvidenceVaultCode(
    @Body("code") code: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    return this.auth.redeemEvidenceVaultCode(code, authorization);
  }

  private setSessionCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = process.env.NODE_ENV === "production";
    response.cookie("crm_access_token", accessToken, {
      httpOnly: true,
      maxAge: ACCESS_COOKIE_MS,
      path: "/",
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    });
    response.cookie("crm_refresh_token", refreshToken, {
      httpOnly: true,
      maxAge: REFRESH_COOKIE_MS,
      path: "/api/auth",
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    });
  }
}
