import { Body, Controller, Get, Put } from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { UpdateWhatsAppSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { WhatsAppService } from "./whatsapp.service";

@Controller("whatsapp")
@PageAccess("EMAIL")
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get("settings")
  @Roles("OWNER")
  settings(@CurrentBusiness() businessId: string) {
    return this.whatsapp.settings(businessId);
  }

  @Put("settings")
  @Roles("OWNER")
  configure(
    @CurrentBusiness() businessId: string,
    @Body() dto: UpdateWhatsAppSettingsDto,
  ) {
    return this.whatsapp.configure(businessId, dto);
  }

  @Get("templates")
  @Roles("OWNER", "STAFF")
  templates(@CurrentBusiness() businessId: string) {
    return this.whatsapp.templates(businessId);
  }
}
