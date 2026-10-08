import { Module } from "@nestjs/common";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { BroadcastsController } from "./broadcasts.controller";
import { BroadcastsService } from "./broadcasts.service";

@Module({
  imports: [WhatsAppModule],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
})
export class BroadcastsModule {}