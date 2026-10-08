"use client";

import type { DealListResponse, DealSummary } from "@insta-crm/shared-types";
import { BriefcaseBusiness, Loader2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatInr } from "@/lib/pipeline";

export function ContactDeals({ contactId }: { contactId: string }) {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<DealListResponse>("/deals?contactId=" + contactId + "&limit=100")
      .then((response) => setDeals(response.items))
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load deals",
        ),
      )
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full text-left">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Deals</h2>
          <p className="text-sm text-muted-foreground">
            {deals.length} active {deals.length === 1 ? "deal" : "deals"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={"/pipeline/new?contactId=" + contactId}>
            <Plus className="mr-2 h-4 w-4" /> Add deal
          </Link>
        </Button>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {deals.map((deal) => (
          <article
            className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3"
            key={deal.id}
          >
            <span
              aria-hidden="true"
              className="h-9 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: deal.stage.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{deal.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {deal.stage.name} · {deal.assignedTo.name}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-700">
                {formatInr(deal.value)}
              </p>
              <Button asChild className="mt-1" size="sm" variant="ghost">
                <Link href={"/pipeline/" + deal.id + "/edit"}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Link>
              </Button>
            </div>
          </article>
        ))}
        {!deals.length && !error ? (
          <div className="rounded-lg border border-dashed px-5 py-8 text-center">
            <BriefcaseBusiness className="mx-auto h-7 w-7 text-slate-400" />
            <h3 className="mt-3 font-semibold">No deals yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the first opportunity for this contact.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
