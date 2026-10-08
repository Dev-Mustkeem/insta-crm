import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { GST_COMPLIANCE_PROVIDER } from "./gst-compliance.provider";
import { InvoiceAutomationService } from "./invoice-automation.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { PlaceholderGSTComplianceProvider } from "./placeholder-gst-compliance.provider";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [InventoryModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    InvoiceAutomationService,
    InvoicePdfService,
    PlaceholderGSTComplianceProvider,
    {
      provide: GST_COMPLIANCE_PROVIDER,
      useExisting: PlaceholderGSTComplianceProvider,
    },
  ],
  exports: [BillingService, InvoiceAutomationService],
})
export class BillingModule {}
