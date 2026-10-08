"use client";

import { ArrowLeft, CalendarClock, Clock, Loader2, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "NEW", label: "New", hint: "Lead received, not yet contacted" },
  { key: "CONTACTED", label: "Contacted", hint: "First call / message / email made" },
  { key: "INTERESTED", label: "Interested", hint: "Lead showed interest or asked questions" },
  { key: "MEETING", label: "Meeting / Demo", hint: "Meeting or demo scheduled or held" },
  { key: "PROPOSAL", label: "Proposal sent", hint: "Quotation or proposal shared" },
  { key: "NEGOTIATION", label: "Negotiation", hint: "Discussing price, terms, objections" },
  { key: "WON", label: "Won", hint: "Deal closed successfully" },
  { key: "LOST", label: "Lost", hint: "Lead dropped or not interested" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

type HistoryEntry = { at: string; from: string; to: string };
type Tracker = {
  stage: StageKey;
  nextFollowUp: string | null;
  stageNotes: Record<string, string>;
  history: HistoryEntry[];
  createdAt?: string;
};

type Payload = {
  batchId: string;
  fileName: string;
  lead: {
    id: number; company?: string; contactName?: string; title?: string; email?: string;
    phone?: string; score: number; tier: "HOT" | "WARM" | "COLD";
  };
  tracker: Tracker;
};

const TIER_BADGE = { HOT: "bg-red-100 text-red-700", WARM: "bg-amber-100 text-amber-700", COLD: "bg-sky-100 text-sky-700" };
const label = (key: string) => STAGES.find((s) => s.key === key)?.label ?? key;
const fmt = (iso: string) =>
  new Date(iso).toLocaleString(typeof document !== "undefined" && document.documentElement.lang === "hi" ? "hi-IN" : "en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const stamp = () => fmt(new Date().toISOString());

export default function LeadTrackerPage() {
  const { batchId, leadId } = useParams<{ batchId: string; leadId: string }>();
  const base = `/leads/${batchId}/leads/${leadId}/tracker`;
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState<Set<StageKey>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const dirty = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const areas = useRef<Partial<Record<StageKey, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    apiFetch<Payload>(base)
      .then((p) => {
        setData(p);
        setNotes(p.tracker.stageNotes ?? {});
        setOpen(new Set([p.tracker.stage]));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load lead"));
  }, [base]);

  const persist = useCallback(
    async (body: Record<string, unknown>) => {
      setSave("saving");
      try {
        const next = await apiFetch<Payload>(base, { method: "PUT", body: JSON.stringify(body) });
        setData((prev) => (prev ? { ...prev, tracker: next.tracker } : next));
        setSave("saved");
        setError("");
      } catch (e) {
        setSave("error");
        setError(e instanceof Error ? e.message : "Save failed");
      }
    },
    [base],
  );

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const pending = dirty.current;
    if (!Object.keys(pending).length) return;
    dirty.current = {};
    await persist({ stageNotes: pending });
  }, [persist]);

  // Save pending notes if the user leaves the page.
  useEffect(() => () => void flush(), [flush]);

  function edit(stage: StageKey, value: string) {
    setNotes((n) => ({ ...n, [stage]: value }));
    dirty.current = { ...dirty.current, [stage]: value };
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  }

  function insertStamp(stage: StageKey) {
    const el = areas.current[stage];
    const current = notes[stage] ?? "";
    const pos = el?.selectionStart ?? current.length;
    const insert = `${current.slice(0, pos) && !current.slice(0, pos).endsWith("\n") ? "\n" : ""}[${stamp()}] `;
    edit(stage, current.slice(0, pos) + insert + current.slice(pos));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + insert.length, pos + insert.length);
    });
  }

  function toggle(stage: StageKey) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  function setStatus(stage: StageKey) {
    setOpen((prev) => new Set(prev).add(stage));
    void persist({ stage });
  }

  if (error && !data) return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-blue-600" />;

  const { lead, tracker } = data;
  const currentIndex = STAGES.findIndex((s) => s.key === tracker.stage);
  const followUp = tracker.nextFollowUp ? tracker.nextFollowUp.slice(0, 10) : "";
  const enteredAt = (stage: string) => [...tracker.history].reverse().find((h) => h.to === stage)?.at;

  return (
    <section className="space-y-5">
      <Link className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" href={`/leads?batch=${batchId}`}>
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <header className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{lead.company || lead.contactName || `Lead #${lead.id}`}</h1>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TIER_BADGE[lead.tier])}>{lead.tier} · {lead.score}/100</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">Status: {label(tracker.stage)}</span>
          <span className="ml-auto text-xs text-muted-foreground" role="status">
            {save === "saving" ? "Saving…" : save === "saved" ? "All changes saved" : save === "error" ? "Not saved" : ""}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[lead.contactName, lead.title].filter(Boolean).join(" · ")} <span className="text-xs">(from {data.fileName})</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          {lead.phone && <a className="inline-flex items-center gap-1 text-blue-700" href={`tel:${lead.phone}`}><Phone className="h-4 w-4" />{lead.phone}</a>}
          {lead.email && <a className="inline-flex items-center gap-1 text-blue-700" href={`mailto:${lead.email}`}><Mail className="h-4 w-4" />{lead.email}</a>}
          <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor="followup">
            <CalendarClock className="h-4 w-4" /> Next follow-up
            <Input
              className="h-8 w-40"
              id="followup"
              onChange={(e) => void persist({ nextFollowUp: e.target.value ? new Date(e.target.value).toISOString() : null })}
              type="date"
              value={followUp}
            />
          </label>
        </div>
      </header>

      {/* Timeline: dots joined by a vertical line, a titled box under each dot */}
      <ol className="relative ml-2">
        <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-slate-300" />
        {STAGES.map((s, i) => {
          const reached = i <= currentIndex && !(tracker.stage === "LOST" && s.key !== "LOST" && s.key !== "NEW" && !tracker.history.some((h) => h.to === s.key));
          const current = s.key === tracker.stage;
          const isOpen = open.has(s.key);
          const entered = enteredAt(s.key);
          const text = notes[s.key] ?? "";
          const dot = current ? (s.key === "LOST" ? "bg-red-500" : "bg-emerald-500") : reached ? "bg-emerald-500" : "bg-slate-400";
          return (
            <li className="relative pb-6 pl-8" key={s.key}>
              <span aria-hidden className={cn("absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full", dot, current && "ring-4 ring-emerald-100")} />
              <div className="flex flex-wrap items-center gap-2">
                <button className="text-left text-base font-bold" onClick={() => toggle(s.key)} type="button">{s.label}</button>
                {current && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Current status</span>}
                {!current && (
                  <button className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-slate-50" onClick={() => setStatus(s.key)} type="button">
                    Set as status
                  </button>
                )}
                <span className="text-xs text-muted-foreground">{s.hint}</span>
              </div>

              {/* grey in-between note, like the "Thought for 1s" rows */}
              <p className="relative mt-1 text-sm text-slate-500">
                <span aria-hidden className="absolute -left-8 top-2 h-[7px] w-[7px] translate-x-[2px] rounded-full bg-slate-300" />
                {entered
                  ? `Moved here on ${fmt(entered)}`
                  : s.key === "NEW"
                    ? `Lead added${tracker.createdAt ? ` on ${fmt(tracker.createdAt)}` : ""}`
                    : reached
                      ? "Passed through this stage"
                      : "Not reached yet"}
              </p>

              {/* the boxed notepad: IN-style gutter + body */}
              <div className="mt-2 overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-1.5">
                  <span className="font-mono text-[11px] font-semibold text-slate-500">NOTES</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {!isOpen && (text.trim() ? text.trim().split("\n")[0] : "No notes yet — click to write")}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {isOpen && (
                      <button className="inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-xs hover:bg-slate-50" onClick={() => insertStamp(s.key)} type="button">
                        <Clock className="h-3 w-3" /> Date &amp; time
                      </button>
                    )}
                    <button className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-slate-100" onClick={() => toggle(s.key)} type="button">
                      {isOpen ? "Collapse" : "Open"}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <textarea
                    aria-label={`Notes for ${s.label} stage`}
                    className="block min-h-[11rem] w-full resize-y bg-amber-50/60 p-3 font-mono text-sm leading-7 outline-none"
                    onChange={(e) => edit(s.key, e.target.value)}
                    placeholder={`What happened at "${s.label}"? Who you spoke to, what was said, objections, promises, next steps…`}
                    ref={(el) => { areas.current[s.key] = el; }}
                    style={{ backgroundImage: "repeating-linear-gradient(transparent, transparent 27px, #e5e7eb 28px)", backgroundAttachment: "local" }}
                    value={text}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
