"use client";

import type {
  AuthResponse,
  BillingSettings,
  CustomerReceivableSummary,
  InvoiceListResponse,
  InvoiceStatus,
  InvoiceSummary,
  ReceivablesAgingSummary,
} from "@insta-crm/shared-types";
import {
  FilePlus2,
  Download,
  IndianRupee,
  Loader2,
  Search,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiDownload, apiFetch } from "@/lib/api";
import {
  formatDate,
  formatInr,
  invoiceStatusClasses,
  invoiceStatusLabels,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

const emptyAging: ReceivablesAgingSummary = {
  outstanding: 0,
  overdue: 0,
  buckets: { current: 0, days0To30: 0, days31To60: 0, days60Plus: 0 },
};

export function BillingDashboard() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [aging, setAging] = useState(emptyAging);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [receivables, setReceivables] = useState<CustomerReceivableSummary[]>(
    [],
  );
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);
  const [error, setError] = useState("");

  const loadInvoices = useCallback(async () => {
    const parameters = new URLSearchParams({ limit: "200" });
    if (status) parameters.set("status", status);
    if (search.trim()) parameters.set("search", search.trim());
    try {
      const result = await apiFetch<InvoiceListResponse>(
        "/billing/invoices?" + parameters.toString(),
      );
      setInvoices(result.items);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load invoices",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    Promise.all([
      apiFetch<ReceivablesAgingSummary>("/billing/aging"),
      apiFetch<BillingSettings>("/billing/settings"),
      apiFetch<CustomerReceivableSummary[]>("/billing/receivables/customers"),
      apiFetch<Pick<AuthResponse, "user">>("/auth/me"),
    ])
      .then(([agingResult, settingResult, customerResult, session]) => {
        setAging(agingResult);
        setSettings(settingResult);
        setReceivables(customerResult);
        setIsOwner(
          session.user.permissions.some(
            (permission) => permission.page === "BILLING" && permission.access === "WRITE",
          ),
        );
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load billing summary",
        ),
      );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInvoices(), 250);
    return () => window.clearTimeout(timer);
  }, [loadInvoices]);

  async function toggleEInvoice() {
    if (!settings) return;
    setSavingSetting(true);
    setError("");
    try {
      const result = await apiFetch<BillingSettings>("/billing/settings", {
        method: "PATCH",
        body: JSON.stringify({
          eInvoiceApplicable: !settings.eInvoiceApplicable,
          gstin: settings.gstin,
          stateCode: settings.stateCode,
        }),
      });
      setSettings(result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update e-invoice setting",
      );
    } finally {
      setSavingSetting(false);
    }
  }

  async function saveTaxIdentity() {
    if (!settings) return;
    setSavingSetting(true);
    setError("");
    try {
      setSettings(
        await apiFetch<BillingSettings>("/billing/settings", {
          method: "PATCH",
          body: JSON.stringify(settings),
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save GST settings",
      );
    } finally {
      setSavingSetting(false);
    }
  }

  async function exportGstr1() {
    setError("");
    try {
      const blob = await apiDownload("/billing/gstr1.csv");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "gstr1-export.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to export GSTR-1 data",
      );
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Billing & invoices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GST-ready invoices, payments, and receivables in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void exportGstr1()} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            GSTR-1 CSV
          </Button>
          <Button asChild>
            <Link href="/invoices/new">
              <FilePlus2 className="mr-2 h-4 w-4" /> Create invoice
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

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AgingCard label="Outstanding" value={aging.outstanding} />
        <AgingCard label="0-30 days overdue" value={aging.buckets.days0To30} />
        <AgingCard
          label="31-60 days overdue"
          value={aging.buckets.days31To60}
        />
        <AgingCard label="60+ days overdue" value={aging.buckets.days60Plus} />
      </div>

      {isOwner ? (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                <Settings2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">E-invoicing applicability</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Manually enable IRN and QR generation for this business.
                </p>
              </div>
            </div>
            <Button
              disabled={!settings || savingSetting}
              onClick={() => void toggleEInvoice()}
              variant={settings?.eInvoiceApplicable ? "default" : "outline"}
            >
              {savingSetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {settings?.eInvoiceApplicable ? "Applicable" : "Not applicable"}
            </Button>
          </CardContent>
          <div className="grid gap-3 border-t px-4 pb-4 pt-4 sm:grid-cols-[1fr_10rem_auto] sm:px-5">
            <Input
              aria-label="Business GSTIN"
              maxLength={15}
              onChange={(event) =>
                setSettings((value) =>
                  value
                    ? {
                        ...value,
                        gstin: event.target.value.toUpperCase() || null,
                      }
                    : value,
                )
              }
              placeholder="Business GSTIN"
              value={settings?.gstin ?? ""}
            />
            <Input
              aria-label="Business state code"
              inputMode="numeric"
              maxLength={2}
              onChange={(event) =>
                setSettings((value) =>
                  value
                    ? { ...value, stateCode: event.target.value || null }
                    : value,
                )
              }
              placeholder="State code"
              value={settings?.stateCode ?? ""}
            />
            <Button
              disabled={!settings || savingSetting}
              onClick={() => void saveTaxIdentity()}
              variant="outline"
            >
              Save GST details
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Customer credit terms</h2>
          <p className="text-sm text-muted-foreground">
            Buyers who have crossed agreed terms are flagged automatically.
          </p>
        </div>
        {receivables.length ? (
          <div className="divide-y">
            {receivables.slice(0, 10).map((item) => (
              <div
                className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_8rem_9rem_8rem] sm:items-center"
                key={item.contact.id}
              >
                <div>
                  <p className="font-medium">{item.contact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.creditTermsDays} day terms
                  </p>
                </div>
                <span className="text-sm">{formatInr(item.outstanding)}</span>
                <span className="text-sm text-red-700">
                  {formatInr(item.overdue)} overdue
                </span>
                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-1 text-xs font-semibold",
                    item.breached
                      ? "bg-red-100 text-red-800"
                      : "bg-emerald-100 text-emerald-800",
                  )}
                >
                  {item.breached ? "Terms breached" : "Within terms"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No open customer receivables.
          </p>
        )}
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_12rem] sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              aria-label="Search invoices"
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice or customer"
              value={search}
            />
          </div>
          <select
            aria-label="Filter invoice status"
            className="h-12 rounded-md border bg-white px-3 outline-none focus:border-primary"
            onChange={(event) =>
              setStatus(event.target.value as InvoiceStatus | "")
            }
            value={status}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {loading ? (
          <div className="grid min-h-56 place-items-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : invoices.length ? (
          <>
            <div className="divide-y md:hidden">
              {invoices.map((invoice) => (
                <InvoiceMobileCard invoice={invoice} key={invoice.id} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Invoice</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Due</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => (
                    <tr className="hover:bg-slate-50" key={invoice.id}>
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold hover:text-primary"
                          href={"/invoices/" + invoice.id}
                        >
                          {invoice.invoiceNumber ?? "Draft invoice"}
                        </Link>
                      </td>
                      <td className="px-5 py-4">{invoice.contact.name}</td>
                      <td className="px-5 py-4">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge status={invoice.status} />
                          {invoice.creditTermsBreached ? (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                              Terms breached
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold">
                        {formatInr(invoice.balanceDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-5 py-14 text-center">
            <IndianRupee className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 font-semibold">No invoices found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a draft invoice or change the current filters.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}

function AgingCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 break-words text-lg font-bold text-slate-900 sm:text-xl">
          {formatInr(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function InvoiceMobileCard({ invoice }: { invoice: InvoiceSummary }) {
  return (
    <Link
      className="block min-h-24 p-4 active:bg-slate-50"
      href={"/invoices/" + invoice.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {invoice.invoiceNumber ?? "Draft invoice"}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {invoice.contact.name} · Due {formatDate(invoice.dueDate)}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-xs text-muted-foreground">Balance due</span>
        <span className="font-bold">{formatInr(invoice.balanceDue)}</span>
      </div>
    </Link>
  );
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        invoiceStatusClasses[status],
      )}
    >
      {invoiceStatusLabels[status]}
    </span>
  );
}
