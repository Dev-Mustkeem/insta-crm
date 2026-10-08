import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { TasksModule } from "../tasks/tasks.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [BillingModule, TasksModule, WhatsAppModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
