"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DealForm } from "@/components/pipeline/deal-form";

export default function NewDealPage() {
  const searchParameters = useSearchParams();
  return (
    <section>
      <Link
        className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/pipeline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to pipeline
      </Link>
      <DealForm
        initialContactId={searchParameters.get("contactId") ?? undefined}
        mode="create"
      />
    </section>
  );
}
