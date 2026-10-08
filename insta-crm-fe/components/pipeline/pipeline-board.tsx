"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type {
  DealListResponse,
  DealSummary,
  PipelineOptionsResponse,
  PipelineStageSummary,
} from "@insta-crm/shared-types";
import {
  ArrowRight,
  BriefcaseBusiness,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatInr } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

export function PipelineBoard() {
  const [stages, setStages] = useState<PipelineStageSummary[]>([]);
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [filterStageId, setFilterStageId] = useState("all");
  const [movingDealId, setMovingDealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canManageStages, setCanManageStages] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    Promise.all([
      apiFetch<PipelineOptionsResponse>("/pipeline/options"),
      apiFetch<DealListResponse>("/deals?limit=100"),
    ])
      .then(([options, result]) => {
        setStages(options.stages);
        setCanManageStages(options.canManageStages);
        setDeals(result.items);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load pipeline",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const moveDeal = useCallback(
    async (dealId: string, stageId: string) => {
      const existing = deals.find((deal) => deal.id === dealId);
      const target = stages.find((stage) => stage.id === stageId);
      if (!existing || !target || existing.stage.id === target.id) return;

      setError("");
      setMovingDealId(dealId);
      setDeals((current) =>
        current.map((deal) =>
          deal.id === dealId ? { ...deal, stage: target } : deal,
        ),
      );
      try {
        const updated = await apiFetch<DealSummary>(
          "/deals/" + dealId + "/stage",
          {
            method: "PATCH",
            body: JSON.stringify({ stageId }),
          },
        );
        setDeals((current) =>
          current.map((deal) => (deal.id === dealId ? updated : deal)),
        );
      } catch (caught) {
        setDeals((current) =>
          current.map((deal) => (deal.id === dealId ? existing : deal)),
        );
        setError(
          caught instanceof Error ? caught.message : "Unable to move deal",
        );
      } finally {
        setMovingDealId(null);
      }
    },
    [deals, stages],
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    void moveDeal(String(event.active.id), String(event.over.id));
  }

  const visibleMobileDeals = useMemo(
    () =>
      filterStageId === "all"
        ? deals
        : deals.filter((deal) => deal.stage.id === filterStageId),
    [deals, filterStageId],
  );

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track every opportunity from first contact to close.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {canManageStages ? (
            <Button asChild variant="outline">
              <Link href="/pipeline/stages">
                <Settings2 className="mr-2 h-4 w-4" /> Stages
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/pipeline/new">
              <Plus className="mr-2 h-4 w-4" /> Add deal
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 hidden lg:block">
        <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <StageColumn
                deals={deals.filter((deal) => deal.stage.id === stage.id)}
                key={stage.id}
                movingDealId={movingDealId}
                stage={stage}
              />
            ))}
          </div>
        </DndContext>
      </div>

      <div className="mt-5 lg:hidden">
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor="mobile-stage-filter"
        >
          Show stage
        </label>
        <select
          className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          id="mobile-stage-filter"
          onChange={(event) => setFilterStageId(event.target.value)}
          value={filterStageId}
        >
          <option value="all">All stages ({deals.length})</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name} (
              {deals.filter((deal) => deal.stage.id === stage.id).length})
            </option>
          ))}
        </select>

        <div className="mt-4 space-y-3">
          {visibleMobileDeals.map((deal) => (
            <MobileDealCard
              deal={deal}
              disabled={movingDealId === deal.id}
              key={deal.id}
              moveDeal={moveDeal}
              stages={stages}
            />
          ))}
          {!visibleMobileDeals.length ? <EmptyPipeline /> : null}
        </div>
      </div>
    </section>
  );
}

function StageColumn({
  deals,
  movingDealId,
  stage,
}: {
  deals: DealSummary[];
  movingDealId: string | null;
  stage: PipelineStageSummary;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, deal) => sum + deal.value, 0);

  return (
    <div
      className={cn(
        "w-72 shrink-0 rounded-lg border bg-slate-100/80 p-3 transition-colors",
        isOver && "border-primary bg-emerald-50",
      )}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h2 className="truncate font-semibold">{stage.name}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} ·{" "}
            {formatInr(total)}
          </p>
        </div>
      </div>
      <div className="min-h-28 space-y-3">
        {deals.map((deal) => (
          <DesktopDealCard
            deal={deal}
            disabled={movingDealId === deal.id}
            key={deal.id}
          />
        ))}
        {!deals.length ? (
          <div className="grid min-h-24 place-items-center rounded-md border border-dashed bg-white/50 px-3 text-center text-xs text-muted-foreground">
            Drop a deal here
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DesktopDealCard({
  deal,
  disabled,
}: {
  deal: DealSummary;
  disabled: boolean;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({ id: deal.id, disabled });
  const style = transform
    ? {
        transform:
          "translate3d(" + transform.x + "px, " + transform.y + "px, 0)",
      }
    : undefined;

  return (
    <article
      className={cn(
        "rounded-md border bg-white p-3 shadow-sm",
        isDragging && "relative z-50 opacity-80 shadow-xl",
        disabled && "opacity-60",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-2">
        <button
          aria-label={"Move " + deal.title}
          className="-ml-1 grid h-9 w-8 shrink-0 touch-none place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <Link
            className="line-clamp-2 font-semibold hover:text-primary hover:underline"
            href={"/pipeline/" + deal.id + "/edit"}
          >
            {deal.title}
          </Link>
          <p className="mt-1 font-bold text-emerald-700">
            {formatInr(deal.value)}
          </p>
        </div>
      </div>
      <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        <Link
          className="flex min-h-8 items-center gap-2 truncate hover:text-primary"
          href={"/contacts/" + deal.contact.id}
        >
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{deal.contact.name}</span>
        </Link>
        <p className="mt-1 truncate">Owner: {deal.assignedTo.name}</p>
      </div>
    </article>
  );
}

function MobileDealCard({
  deal,
  disabled,
  moveDeal,
  stages,
}: {
  deal: DealSummary;
  disabled: boolean;
  moveDeal: (dealId: string, stageId: string) => Promise<void>;
  stages: PipelineStageSummary[];
}) {
  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words font-semibold">{deal.title}</h2>
          <p className="mt-1 text-lg font-bold text-emerald-700">
            {formatInr(deal.value)}
          </p>
        </div>
        <Button
          asChild
          aria-label={"Edit " + deal.title}
          size="icon"
          variant="ghost"
        >
          <Link href={"/pipeline/" + deal.id + "/edit"}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <Link
        className="mt-2 flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        href={"/contacts/" + deal.contact.id}
      >
        <UserRound className="h-4 w-4 shrink-0" /> {deal.contact.name}
        <ArrowRight className="ml-auto h-4 w-4" />
      </Link>
      <label
        className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        htmlFor={"deal-stage-" + deal.id}
      >
        Stage
      </label>
      <div className="relative mt-1">
        <select
          className="h-12 w-full rounded-md border bg-white px-3 pr-10 font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
          disabled={disabled}
          id={"deal-stage-" + deal.id}
          onChange={(event) => void moveDeal(deal.id, event.target.value)}
          value={deal.stage.id}
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        {disabled ? (
          <Loader2 className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 animate-spin text-primary" />
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Assigned to {deal.assignedTo.name}
      </p>
    </article>
  );
}

function EmptyPipeline() {
  return (
    <div className="rounded-lg border border-dashed bg-white px-6 py-10 text-center">
      <BriefcaseBusiness className="mx-auto h-7 w-7 text-slate-400" />
      <h2 className="mt-3 font-semibold">No deals in this stage</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add an opportunity or choose another stage.
      </p>
    </div>
  );
}
