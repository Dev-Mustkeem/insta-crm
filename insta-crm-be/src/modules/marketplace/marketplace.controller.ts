import { Body, Controller, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../common/decorators/public.decorator";
import { MarketplaceService } from "./marketplace.service";

@Controller("webhooks/marketplaces")
export class MarketplaceController {
  constructor(
    private readonly config: ConfigService,
    private readonly marketplace: MarketplaceService,
  ) {}

  @Post("indiamart/:businessId")
  @Public()
  receive(
    @Param("businessId") businessId: string,
    @Headers("x-marketplace-token") token: string | undefined,
    @Body() payload: unknown,
  ) {
    const expected = this.config.get<string>("INDIAMART_WEBHOOK_TOKEN", "");
    if (!expected || token !== expected) throw new UnauthorizedException("Invalid marketplace webhook token");
    return this.marketplace.ingest(businessId, "indiamart", payload);
  }
}