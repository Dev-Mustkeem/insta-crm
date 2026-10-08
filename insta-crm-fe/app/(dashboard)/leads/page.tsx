"use client";

import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Flame,
  Loader2,
  Snowflake,
  Sun,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tier = "HOT" | "WARM" | "COLD";

type Step = {
  step: number;
  key: string;
  label: string;
  score: number;
  weight: number;
  verdict: "Strong" | "Moderate" | "Weak";
  reason: string;
};

type Lead = {
  id: number;
  company?: string;
  contactName?: string;
  title?: string;
  email?: string;
  phone?: string;
  industry?: string;
  value?: string;
  source?: string;
  status?: string;
  notes?: string;
  score: number;
  tier: Tier;
  steps: Step[];
};

type BatchSummary = {
  id: string;
  fileName: string;
  fileType: string;
  totalLeads: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  createdAt: string;
};

type Batch = BatchSummary & { leads: Lead[]; stages?: Record<number, string> };

const STAGE_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", INTERESTED: "Interested", MEETING: "Meeting / Demo",
  PROPOSAL: "Proposal sent", NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
};

const TIERS: Record<Tier, { label: string; icon: typeof Flame; badge: string; ring: string; bar: string }> = {
  HOT: { label: "Hot leads", icon: Flame, badge: "bg-red-100 text-red-700", ring: "border-red-300 bg-red-50", bar: "bg-red-500" },
  WARM: { label: "Warm leads", icon: Sun, badge: "bg-amber-100 text-amber-700", ring: "border-amber-300 bg-amber-50", bar: "bg-amber-500" },
  COLD: { label: "Cold leads", icon: Snowflake, badge: "bg-sky-100 text-sky-700", ring: "border-sky-300 bg-sky-50", bar: "bg-sky-500" },
};

const VERDICT_COLOR = { Strong: "bg-emerald-500", Moderate: "bg-amber-400", Weak: "bg-slate-300" } as const;

export default function LeadsPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [tier, setTier] = useState<Tier | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadList(selectLatest = false) {
    const list = await apiFetch<BatchSummary[]>("/leads");
    setBatches(list);
    const wanted = new URLSearchParams(window.location.search).get("batch");
    const target = list.find((b) => b.id === wanted) ?? list[0];
    if (selectLatest && target) await open(target.id);
  }

  async function open(id: string) {
    setBatch(await apiFetch<Batch>(`/leads/${id}`));
    setTier("ALL");
    setOpenId(null);
  }

  useEffect(() => {
    loadList(true).catch((e) => setError(e instanceof Error ? e.message : "Unable to load leads"));
  }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch<Batch>("/leads/upload", { method: "POST", body: form });
      setBatch(result);
      setTier("ALL");
      setOpenId(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this lead report?")) return;
    await apiFetch(`/leads/${id}`, { method: "DELETE" });
    if (batch?.id === id) setBatch(null);
    await loadList(batch?.id === id);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (batch?.leads ?? []).filter(
      (l) =>
        (tier === "ALL" || l.tier === tier) &&
        (!q || [l.company, l.contactName, l.email, l.phone, l.industry].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [batch, tier, query]);

  const counts: Record<Tier, number> = {
    HOT: batch?.hotCount ?? 0,
    WARM: batch?.warmCount ?? 0,
    COLD: batch?.coldCount ?? 0,
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a company leads report (Excel, CSV or PDF). Every lead is scored through an 8-step depth
          classification and sorted into Hot, Warm or Cold.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed bg-white p-8 text-center transition-colors",
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300",
        )}
        onDragOver={(e: DragEvent) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files[0]); }}
      >
        {uploading ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> : <UploadCloud className="h-8 w-8 text-slate-400" />}
        <p className="text-sm">{uploading ? "Reading and classifying leads…" : "Drag & drop a leads report here, or"}</p>
        <input
          accept=".xlsx,.xls,.csv,.pdf"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => void upload(e.target.files?.[0])}
          ref={fileInput}
          type="file"
        />
        <Button disabled={uploading} onClick={() => fileInput.current?.click()} type="button">
          Choose file
        </Button>
        <p className="text-xs text-muted-foreground">
          .xlsx, .xls, .csv, .pdf · up to 15 MB. Useful columns: Company, Name, Title, Email, Phone, Industry,
          Employees, Value, Source, Status, Notes, Timeline, Last Contact.
        </p>
        {error ? <p className="w-full rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>

      {batches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reports</span>
          {batches.map((b) => (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs",
                batch?.id === b.id && "border-blue-500 bg-blue-50",
              )}
              key={b.id}
            >
              <button className="inline-flex items-center gap-1" onClick={() => void open(b.id)} type="button">
                {b.fileType === "pdf" ? <FileText className="h-3 w-3" /> : <FileSpreadsheet className="h-3 w-3" />}
                {b.fileName} ({b.totalLeads})
              </button>
              <button aria-label={`Delete ${b.fileName}`} onClick={() => void remove(b.id)} type="button">
                <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-600" />
              </button>
            </span>
          ))}
        </div>
      )}

      {batch && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(TIERS) as Tier[]).map((t) => {
              const meta = TIERS[t];
              const Icon = meta.icon;
              return (
                <button
                  className={cn(
                    "rounded-lg border p-4 text-left shadow-sm transition",
                    meta.ring,
                    tier === t ? "ring-2 ring-offset-1 ring-slate-400" : "opacity-90 hover:opacity-100",
                  )}
                  key={t}
                  onClick={() => setTier(tier === t ? "ALL" : t)}
                  type="button"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{meta.label}</div>
                  <p className="mt-2 text-3xl font-bold">{counts[t]}</p>
                  <p className="text-xs text-muted-foreground">
                    {`${batch.totalLeads ? Math.round((counts[t] / batch.totalLeads) * 100) : 0}% of ${batch.totalLeads}`}
                  </p>
                </button>
              );
            })}
          </div>

          <Input onChange={(e) => setQuery(e.target.value)} placeholder="Search company, name, email, phone, industry" value={query} />

          <div className="grid gap-3">
            {visible.length === 0 && <p className="text-sm text-muted-foreground">No leads match this filter.</p>}
            {visible.map((lead) => {
              const meta = TIERS[lead.tier];
              const expanded = openId === lead.id;
              return (
                <article className="rounded-lg border bg-white shadow-sm" key={lead.id}>
                  <div className="flex w-full items-center gap-3 p-4">
                    <Link
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      href={`/leads/${batch.id}/${lead.id}`}
                      title="Open communication tracker"
                    >
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.badge)}>{lead.tier}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{lead.company || lead.contactName || `Lead #${lead.id}`}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[lead.contactName, lead.title, lead.email, lead.phone].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="hidden shrink-0 rounded bg-slate-100 px-2 py-1 text-xs sm:inline">
                        {STAGE_LABELS[batch.stages?.[lead.id] ?? "NEW"]}
                      </span>
                      <div className="w-24 shrink-0">
                        <p className="text-right text-sm font-bold">{lead.score}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
                        <div className="mt-1 h-1.5 rounded bg-slate-100"><div className={cn("h-1.5 rounded", meta.bar)} style={{ width: `${lead.score}%` }} /></div>
                      </div>
                    </Link>
                    <button
                      aria-label="Show classification steps"
                      className="shrink-0 rounded p-1 hover:bg-slate-100"
                      onClick={() => setOpenId(expanded ? null : lead.id)}
                      type="button"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                    </button>
                  </div>
                  {expanded && (
                    <div className="border-t px-4 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">8-step classification</p>
                      <ol className="space-y-2">
                        {lead.steps.map((s) => (
                          <li className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm" key={s.key}>
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs font-semibold">{s.step}</span>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{s.label} <span className="text-xs text-muted-foreground">{`(weight ${s.weight}%)`}</span></span>
                                <span className="text-xs">{`${s.verdict} · ${s.score}`}</span>
                              </div>
                              <div className="mt-1 h-1.5 rounded bg-slate-100"><div className={cn("h-1.5 rounded", VERDICT_COLOR[s.verdict])} style={{ width: `${s.score}%` }} /></div>
                              <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {(lead.notes || lead.industry || lead.value || lead.source || lead.status) && (
                        <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                          {([["Industry", lead.industry], ["Value", lead.value], ["Source", lead.source], ["Status", lead.status], ["Notes", lead.notes]] as const)
                            .filter(([, v]) => v)
                            .map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline text-muted-foreground">{v}</dd></div>)}
                        </dl>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
