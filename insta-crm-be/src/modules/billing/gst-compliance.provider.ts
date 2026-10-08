import type { InvoiceLineItem } from "@insta-crm/shared-types";

export const GST_COMPLIANCE_PROVIDER = Symbol("GST_COMPLIANCE_PROVIDER");

export interface GSTComplianceInvoice {
  businessId: string;
  businessName: string;
  invoiceId: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  customer: { name: string; phone: string; email: string | null };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface GSTComplianceResult {
  irn: string;
  qrCodeUrl: string;
}

export interface GSTComplianceProvider {
  generateInvoice(invoice: GSTComplianceInvoice): Promise<GSTComplianceResult>;
}
