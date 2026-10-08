import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { SaveTrackerDto } from "./dto/save-tracker.dto";
import { LeadsService } from "./leads.service";

@Controller("leads")
@PageAccess("LEADS")
@Roles("OWNER", "STAFF")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  upload(
    @CurrentBusiness() businessId: string,
    @UploadedFile() file?: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
    },
  ) {
    return this.leads.upload(businessId, file);
  }

  @Get()
  list(@CurrentBusiness() businessId: string) {
    return this.leads.list(businessId);
  }

  @Get(":id")
  detail(@CurrentBusiness() businessId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.leads.detail(businessId, id);
  }

  @Get(":id/leads/:leadId/tracker")
  tracker(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("leadId", ParseIntPipe) leadId: number,
  ) {
    return this.leads.getTracker(businessId, id, leadId);
  }

  @Put(":id/leads/:leadId/tracker")
  saveTracker(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("leadId", ParseIntPipe) leadId: number,
    @Body() dto: SaveTrackerDto,
  ) {
    return this.leads.saveTracker(businessId, id, leadId, dto);
  }

  @Delete(":id")
  remove(@CurrentBusiness() businessId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.leads.remove(businessId, id);
  }
}
