import { Controller, Get, Query } from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { AuditQueryDto } from "./audit-query.dto";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
@PageAccess("AUDIT")
@Roles("OWNER")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentBusiness() businessId: string, @Query() query: AuditQueryDto) {
    return this.audit.list(businessId, query);
  }
}
