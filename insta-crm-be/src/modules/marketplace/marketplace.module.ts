import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";

@Module({
  imports: [ContactsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}