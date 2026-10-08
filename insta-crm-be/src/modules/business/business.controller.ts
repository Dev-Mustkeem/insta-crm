import { Body, Controller, Patch } from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BusinessService } from "./business.service";
import { CompleteSetupDto } from "./dto/complete-setup.dto";

@Controller("business")
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Patch("setup")
  @Roles("OWNER")
  completeSetup(
    @CurrentBusiness() businessId: string,
    @Body() dto: CompleteSetupDto,
  ) {
    return this.business.completeSetup(businessId, dto);
  }

  @Patch("inventory-settings")
  @Roles("OWNER")
  setInventory(
    @CurrentBusiness() businessId: string,
    @Body() dto: { enabled: boolean },
  ) {
    return this.business.setInventoryEnabled(businessId, dto.enabled);
  }
}
