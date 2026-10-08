import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  GSTComplianceInvoice,
  GSTComplianceProvider,
  GSTComplianceResult,
} from "./gst-compliance.provider";

@Injectable()
export class PlaceholderGSTComplianceProvider implements GSTComplianceProvider {
  async generateInvoice(
    invoice: GSTComplianceInvoice,
  ): Promise<GSTComplianceResult> {
    const irn = createHash("sha256")
      .update(
        [
          invoice.businessId,
          invoice.invoiceId,
          invoice.invoiceNumber,
          invoice.grandTotal.toFixed(2),
        ].join("|"),
      )
      .digest("hex");
    return {
      irn,
      qrCodeUrl: "https://einvoice.example.invalid/verify/" + irn,
    };
  }
}
