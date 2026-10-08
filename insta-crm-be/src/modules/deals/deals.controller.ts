import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { DealsService } from "./deals.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { ListDealsQueryDto } from "./dto/list-deals-query.dto";
import { MoveDealStageDto } from "./dto/move-deal-stage.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";

@Controller("deals")
@PageAccess("PIPELINE")
@Roles("OWNER", "STAFF")
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDealDto,
  ) {
    return this.deals.create(businessId, user, dto);
  }

  @Get()
  list(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListDealsQueryDto,
  ) {
    return this.deals.list(businessId, user, query);
  }

  @Get(":id/activities")
  activities(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) dealId: string,
  ) {
    return this.deals.activities(businessId, user, dealId);
  }

  @Get(":id")
  findOne(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) dealId: string,
  ) {
    return this.deals.findOne(businessId, user, dealId);
  }

  @Patch(":id/stage")
  moveStage(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) dealId: string,
    @Body() dto: MoveDealStageDto,
  ) {
    return this.deals.moveStage(businessId, user, dealId, dto.stageId);
  }

  @Patch(":id")
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) dealId: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.deals.update(businessId, user, dealId, dto);
  }

  @Delete(":id")
  remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) dealId: string,
  ) {
    return this.deals.remove(businessId, user, dealId);
  }
}
