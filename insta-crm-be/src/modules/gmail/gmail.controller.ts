import { Body, Controller, Delete, Get, Post, Put, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { GmailService } from "./gmail.service";
import { SaveGmailOAuthConfigDto } from "./dto/save-gmail-oauth-config.dto";
import { SaveSmtpConfigDto } from "./dto/save-smtp-config.dto";
import { SmtpService } from "./smtp.service";

@Controller("gmail")
@PageAccess("EMAIL")
export class GmailController {
  constructor(private readonly gmail: GmailService, private readonly smtp: SmtpService) {}

  @Get("smtp-settings")
  @Roles("OWNER", "STAFF")
  async smtpSettings(@CurrentBusiness() businessId: string, @CurrentUser() user: JwtPayload) {
    return { ...(await this.smtp.settings(businessId)), canEdit: ["SUPER_ADMIN", "OWNER"].includes(user.role) };
  }

  @Put("smtp-settings")
  @Roles("OWNER")
  saveSmtpSettings(@CurrentBusiness() businessId: string, @Body() dto: SaveSmtpConfigDto) {
    return this.smtp.saveSettings(businessId, dto);
  }

  @Delete("smtp-settings")
  @Roles("OWNER")
  disconnectSmtp(@CurrentBusiness() businessId: string) {
    return this.smtp.disconnect(businessId);
  }

  @Get("settings")
  @Roles("OWNER", "STAFF")
  settings(@CurrentBusiness() businessId: string) {
    return this.gmail.settings(businessId);
  }

  @Get("oauth-config")
  @Roles("OWNER", "STAFF")
  async oauthSettings(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return { ...(await this.gmail.oauthSettings(businessId)), canEdit: ["SUPER_ADMIN", "OWNER"].includes(user.role) };
  }

  @Put("oauth-config")
  @Roles("OWNER")
  saveOAuthSettings(
    @CurrentBusiness() businessId: string,
    @Body() dto: SaveGmailOAuthConfigDto,
  ) {
    return this.gmail.saveOAuthSettings(businessId, dto);
  }

  @Get("connect")
  @Roles("OWNER")
  async connect(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Res() response: Response,
  ) {
    return response.redirect(
      302,
      await this.gmail.authorizationUrl(businessId, user.sub),
    );
  }

  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string | undefined,
    @Res() response: Response,
  ) {
    const destination = await this.gmail.completeAuthorization(
      code,
      state,
      error,
    );
    return response.redirect(302, destination);
  }

  @Post("sync")
  @Roles("OWNER", "STAFF")
  sync(@CurrentBusiness() businessId: string) {
    return this.gmail.sync(businessId);
  }

  @Delete("connection")
  @Roles("OWNER")
  disconnect(@CurrentBusiness() businessId: string) {
    return this.gmail.disconnect(businessId);
  }
}
