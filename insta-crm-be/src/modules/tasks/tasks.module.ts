import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { TaskAutomationService } from "./task-automation.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [BillingModule, WhatsAppModule],
  controllers: [TasksController],
  providers: [TasksService, TaskAutomationService],
  exports: [TasksService],
})
export class TasksModule {}
