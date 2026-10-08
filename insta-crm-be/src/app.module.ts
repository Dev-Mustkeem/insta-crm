import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AuditLogInterceptor } from "./common/interceptors/audit-log.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PagePermissionGuard } from "./common/guards/page-permission.guard";
import { BusinessContextInterceptor } from "./common/interceptors/business-context.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { BroadcastsModule } from "./modules/broadcasts/broadcasts.module";
import { BillingModule } from "./modules/billing/billing.module";
import { BusinessModule } from "./modules/business/business.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { DealsModule } from "./modules/deals/deals.module";
import { HealthModule } from "./modules/health/health.module";
import { GmailModule } from "./modules/gmail/gmail.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { PipelineModule } from "./modules/pipeline/pipeline.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../.env.local"],
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AuditModule,
    BroadcastsModule,
    BillingModule,
    BusinessModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    DealsModule,
    PipelineModule,
    MarketplaceModule,
    ReportsModule,
    TasksModule,
    WhatsAppModule,
    HealthModule,
    GmailModule,
    InventoryModule,
    LeadsModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PagePermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: BusinessContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
