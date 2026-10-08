import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { CreateBroadcastDto } from "./dto/create-broadcast.dto";
import { BroadcastsService } from "./broadcasts.service";

@Controller("broadcasts")
@PageAccess("BROADCASTS")
@Roles("OWNER", "STAFF")
export class BroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Get()
  list(@CurrentBusiness() businessId: string) {
    return this.broadcasts.list(businessId);
  }

  @Get(":id")
  detail(@CurrentBusiness() businessId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.broadcasts.detail(businessId, id);
  }

  @Post()
  @Roles("OWNER")
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser() actor: JwtPayload,
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.broadcasts.createAndSend(businessId, actor, dto);
  }
}
