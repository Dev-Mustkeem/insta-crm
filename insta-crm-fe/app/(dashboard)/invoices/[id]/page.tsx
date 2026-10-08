import { InvoiceDetail } from "@/components/billing/invoice-detail";

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <InvoiceDetail invoiceId={params.id} />;
}
