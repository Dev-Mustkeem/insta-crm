import { Controller, Get } from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportsService } from "./reports.service";

@Controller("reports/dashboard")
@PageAccess("DASHBOARD")
@Roles("OWNER", "ACCOUNTANT")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("summary")
  summary(@CurrentBusiness() businessId: string) {
    return this.reports.summary(businessId);
  }

  @Get("top-customers")
  topCustomers(@CurrentBusiness() businessId: string) {
    return this.reports.topCustomers(businessId);
  }

  @Get("new-leads")
  newLeads(@CurrentBusiness() businessId: string) {
    return this.reports.newLeads(businessId);
  }
}
