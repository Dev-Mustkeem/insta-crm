import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { CreateStageDto } from "./dto/create-stage.dto";
import { UpdateStageDto } from "./dto/update-stage.dto";
import { PipelineService } from "./pipeline.service";

@Controller("pipeline")
@PageAccess("PIPELINE")
@Roles("OWNER", "STAFF")
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get("options")
  options(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pipeline.options(businessId, user);
  }

  @Get("stages")
  listStages(@CurrentBusiness() businessId: string) {
    return this.pipeline.listStages(businessId);
  }

  @Post("stages")
  @Roles("OWNER")
  createStage(
    @CurrentBusiness() businessId: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.pipeline.createStage(businessId, dto);
  }

  @Patch("stages/:id")
  @Roles("OWNER")
  updateStage(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.pipeline.updateStage(businessId, stageId, dto);
  }

  @Delete("stages/:id")
  @Roles("OWNER")
  removeStage(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) stageId: string,
  ) {
    return this.pipeline.removeStage(businessId, stageId);
  }
}
