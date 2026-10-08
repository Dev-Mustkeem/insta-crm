"use client";

import type {
  DashboardSummary,
  LeadSourceMetric,
  TopCustomerMetric,
} from "@insta-crm/shared-types";
import {
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  IndianRupee,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

const sourceLabels: Record<LeadSourceMetric["source"], string> = {
  gmail: "Email",
  whatsapp: "WhatsApp",
  website: "Website",
  marketplace: "Marketplace",
  "walk-in": "Walk-in",
  referral: "Referral",
  other: "Other",
};

export function OwnerDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<TopCustomerMetric[]>([]);
  const [leads, setLeads] = useState<LeadSourceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextCustomers, nextLeads] = await Promise.all([
        apiFetch<DashboardSummary>("/reports/dashboard/summary"),
        apiFetch<TopCustomerMetric[]>("/reports/dashboard/top-customers"),
        apiFetch<LeadSourceMetric[]>("/reports/dashboard/new-leads"),
      ]);
      setSummary(nextSummary);
      setCustomers(nextCustomers);
      setLeads(nextLeads);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !summary) {
    return (
      <div
        className="grid min-h-[55vh] place-items-center"
        aria-label="Loading dashboard"
      >
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CircleAlert className="mx-auto h-8 w-8 text-red-500" />
          <h1 className="mt-3 text-xl font-bold">Dashboard unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={() => void load()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalNewLeads = leads.reduce((sum, item) => sum + item.count, 0);

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#00A651" }}>
            Today at a glance
          </p>
          <h1
            id="dashboard-heading"
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Owner dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales, follow-ups and money needing attention.
          </p>
        </div>
        <Button
          aria-label="Refresh dashboard"
          className="min-h-11 min-w-11"
          disabled={loading}
          onClick={() => void load()}
          size="icon"
          variant="outline"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </header>

      {error ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="status"
        >
          Showing the last update. Refresh failed: {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          accent="emerald"
          detail={`${summary.openPipeline.count} open deals`}
          href="/pipeline"
          icon={TrendingUp}
          label="Open pipeline"
          value={compactMoney(summary.openPipeline.value)}
        />
        <MetricCard
          accent="blue"
          detail={compactMoney(summary.wonThisMonth.value)}
          href="/pipeline"
          icon={CircleCheckBig}
          label="Won this month"
          value={String(summary.wonThisMonth.count)}
        />
        <MetricCard
          accent={summary.overdueTasks ? "red" : "slate"}
          detail={summary.overdueTasks ? "Needs action now" : "All caught up"}
          href="/today"
          icon={CircleAlert}
          label="Overdue tasks"
          value={String(summary.overdueTasks)}
        />
        <MetricCard
          accent="amber"
          detail={`${compactMoney(summary.receivables.overdue)} overdue`}
          href="/invoices"
          icon={IndianRupee}
          label="Receivables due"
          value={compactMoney(summary.receivables.outstanding)}
        />
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Receivables aging</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What is due, grouped by age
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-semibold"
              href="/invoices"
              style={{ color: "#0057A8" }}
            >
              View bills
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <AgingBucket
              label="Current"
              value={summary.receivables.buckets.current}
            />
            <AgingBucket
              label="1–30 days"
              value={summary.receivables.buckets.days0To30}
            />
            <AgingBucket
              label="31–60 days"
              value={summary.receivables.buckets.days31To60}
            />
            <AgingBucket
              label="60+ days"
              value={summary.receivables.buckets.days60Plus}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarCard
          empty="Deal values will appear after you add deals."
          icon={UsersRound}
          items={customers.map((item) => ({
            key: item.contact.id,
            label: item.contact.name,
            value: item.dealValue,
            valueLabel: compactMoney(item.dealValue),
            detail: `${item.dealCount} ${item.dealCount === 1 ? "deal" : "deals"}`,
          }))}
          title="Top customers by deal value"
        />
        <BarCard
          empty="New leads added this week will appear here."
          icon={TrendingUp}
          items={leads
            .filter((item) => item.count > 0)
            .map((item) => ({
              key: item.source,
              label: sourceLabels[item.source],
              value: item.count,
              valueLabel: String(item.count),
              detail: "",
            }))}
          subtitle={`${totalNewLeads} new this week`}
          title="New leads by source"
        />
      </div>

      <div>
        <h2 className="mb-3 font-bold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/contacts/new" icon={Plus} label="Add contact" />
          <QuickAction
            href="/pipeline"
            icon={TrendingUp}
            label="Open pipeline"
          />
          <QuickAction href="/gmail" icon={Mail} label="Email" />
          <QuickAction
            href="/invoices/new"
            icon={IndianRupee}
            label="New invoice"
          />
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  accent,
  detail,
  href,
  icon: Icon,
  label,
  value,
}: {
  accent: "amber" | "blue" | "emerald" | "red" | "slate";
  detail: string;
  href: string;
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  const accents = {
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Link
      href={href}
      className="min-w-0 rounded-xl border-2 bg-white p-4 transition-all duration-150 hover:shadow-insta"
      style={{ borderColor: "#e2eaf4" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#0057A8")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#e2eaf4")}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-lg ${accents[accent]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl"
        title={value}
        style={{ color: "#003a62" }}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

function AgingBucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold" title={money(value)}>
        {compactMoney(value)}
      </p>
    </div>
  );
}

interface BarItem {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  detail: string;
}

function BarCard({
  empty,
  icon: Icon,
  items,
  subtitle,
  title,
}: {
  empty: string;
  icon: typeof TrendingUp;
  items: BarItem[];
  subtitle?: string;
  title: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(0,87,168,0.08)", color: "#0057A8" }}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold">{title}</h2>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {items.length ? (
          <div className="mt-5 space-y-4">
            {items.map((item) => (
              <div key={item.key}>
                <div className="flex items-end justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.label}</p>
                    {item.detail ? (
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-bold">{item.valueLabel}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #0057A8 0%, #00A651 100%)",
                      width: `${Math.max(5, (item.value / max) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-2 rounded-xl border-2 bg-white px-4 text-sm font-semibold transition-all duration-150"
      style={{ borderColor: "#e2eaf4", color: "#003a62" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#0057A8"; e.currentTarget.style.background = "#f0f6ff"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2eaf4"; e.currentTarget.style.background = "#fff"; }}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: "#0057A8" }} /> {label}
      </span>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100_000 ? 1 : 0,
  }).format(value);
}
