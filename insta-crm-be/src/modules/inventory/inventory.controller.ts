import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
@PageAccess("BILLING")
@Roles("OWNER", "ACCOUNTANT")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@CurrentBusiness() businessId: string, @CurrentUser() actor: JwtPayload) {
    return this.inventory.list(businessId, actor);
  }

  @Get(":id/movements")
  movements(@CurrentBusiness() businessId: string, @Param("id", ParseUUIDPipe) itemId: string) {
    return this.inventory.movements(businessId, itemId);
  }

  @Post()
  @Roles("OWNER")
  create(@CurrentBusiness() businessId: string, @CurrentUser() actor: JwtPayload, @Body() dto: CreateInventoryItemDto) {
    return this.inventory.create(businessId, actor, dto);
  }

  @Patch(":id/stock")
  @Roles("OWNER")
  adjust(@CurrentBusiness() businessId: string, @CurrentUser() actor: JwtPayload, @Param("id", ParseUUIDPipe) itemId: string, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(businessId, actor, itemId, dto);
  }
}
