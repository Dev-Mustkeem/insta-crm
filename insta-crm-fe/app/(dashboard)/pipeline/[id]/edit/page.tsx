"use client";

import type { DealSummary } from "@insta-crm/shared-types";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DealForm } from "@/components/pipeline/deal-form";
import { EntityTasks } from "@/components/tasks/entity-tasks";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function EditDealPage({ params }: { params: { id: string } }) {
  const [deal, setDeal] = useState<DealSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<DealSummary>("/deals/" + params.id)
      .then(setDeal)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load deal",
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
          <Link href="/pipeline">Back to pipeline</Link>
        </Button>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section>
      <Link
        className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/pipeline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to pipeline
      </Link>
      <DealForm deal={deal} mode="edit" />
      <div className="mx-auto mt-5 max-w-2xl">
        <EntityTasks entityId={deal.id} entityType="deal" />
      </div>
    </section>
  );
}
