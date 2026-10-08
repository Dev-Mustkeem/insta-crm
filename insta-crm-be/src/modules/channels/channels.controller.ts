import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ChannelsService } from "./channels.service";
import { UpdateChannelSettingsDto } from "./dto/update-channel-settings.dto";

@Controller("channels")
@PageAccess("EMAIL")
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get("settings")
  @Roles("OWNER")
  settings(@CurrentBusiness() businessId: string) {
    return this.channels.settings(businessId);
  }

  @Put("settings")
  @Roles("OWNER")
  configure(
    @CurrentBusiness() businessId: string,
    @Body() dto: UpdateChannelSettingsDto,
  ) {
    return this.channels.configure(businessId, dto);
  }

  @Public()
  @Post("webhooks/sms/:connectionId")
  receiveSms(
    @Param("connectionId", ParseUUIDPipe) connectionId: string,
    @Headers("x-webhook-token") token: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.channels.receiveSms(connectionId, token, payload);
  }

  @Public()
  @Post("webhooks/resend")
  receiveEmail(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.channels.receiveEmail(
      request.rawBody || Buffer.from(JSON.stringify(payload)),
      headers,
      payload,
    );
  }
}
