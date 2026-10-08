"use client";

import type { InvoiceDetail } from "@insta-crm/shared-types";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<InvoiceDetail>("/billing/invoices/" + params.id)
      .then(setInvoice)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load invoice",
        ),
      );
  }, [params.id]);

  if (error) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-red-700" role="alert">
          {error}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={"/invoices/" + params.id}>Back to invoice</Link>
        </Button>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <section>
      <Link
        className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href={"/invoices/" + invoice.id}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Invoice
      </Link>
      <InvoiceForm invoice={invoice} />
    </section>
  );
}
