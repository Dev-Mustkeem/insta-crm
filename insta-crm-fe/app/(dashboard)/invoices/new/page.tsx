import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { InvoiceForm } from "@/components/billing/invoice-form";

export default function NewInvoicePage({
  searchParams,
}: {
  searchParams: { dealId?: string };
}) {
  return (
    <section>
      <Link
        className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/invoices"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Invoices
      </Link>
      <InvoiceForm initialDealId={searchParams.dealId} />
    </section>
  );
}
