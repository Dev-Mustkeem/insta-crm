import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../../common/decorators/public.decorator";
import { timingSafeEqual } from "node:crypto";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service";

@Controller("webhooks/360dialog")
export class WhatsAppWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly webhooks: WhatsAppWebhookService,
  ) {}

  @Post()
  @Public()
  async receive(
    @Headers("authorization") authorization: string | undefined,
    @Body() payload: unknown,
  ) {
    this.authorize(authorization);
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException("Webhook payload must be an object");
    }
    
    // Process webhook payload synchronously instead of adding it to a queue
    await this.webhooks.process(payload);
    
    return { received: true };
  }

  private authorize(value: string | undefined) {
    const token = this.config.get<string>("WHATSAPP_WEBHOOK_TOKEN", "");
    const expected = Buffer.from("Bearer " + token);
    const received = Buffer.from(value || "");
    if (
      token.length < 16 ||
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException("Invalid webhook authorization");
    }
  }
}
