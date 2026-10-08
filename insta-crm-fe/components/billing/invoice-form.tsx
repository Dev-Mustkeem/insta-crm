"use client";

import type {
  BillingOptionsResponse,
  InvoiceDetail,
  InvoiceInput,
  InvoiceLineItem,
  InvoicePrefillResponse,
} from "@insta-crm/shared-types";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { formatInr } from "@/lib/billing";

type FormLine = InvoiceLineItem & { key: string };

export function InvoiceForm({
  initialDealId,
  invoice,
}: {
  initialDealId?: string;
  invoice?: InvoiceDetail;
}) {
  const router = useRouter();
  const sequence = useRef(0);
  const makeLine = (value?: Partial<InvoiceLineItem>): FormLine => ({
    key: "line-" + sequence.current++,
    description: value?.description ?? "",
    hsnSacCode: value?.hsnSacCode ?? "",
    quantity: value?.quantity ?? 1,
    rate: value?.rate ?? 0,
    discountPercent: value?.discountPercent ?? 0,
    taxPercent: value?.taxPercent ?? 18,
  });
  const [options, setOptions] = useState<BillingOptionsResponse | null>(null);
  const [contactId, setContactId] = useState(invoice?.contact.id ?? "");
  const [dealId, setDealId] = useState(
    invoice?.deal?.id ?? initialDealId ?? "",
  );
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate.slice(0, 10) ?? defaultDueDate(),
  );
  const [lines, setLines] = useState<FormLine[]>(() =>
    invoice?.lineItems.length
      ? invoice.lineItems.map((item) => makeLine(item))
      : [makeLine()],
  );
  const [prefillSource, setPrefillSource] = useState<
    "quotation" | "deal" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<BillingOptionsResponse>("/billing/options")
      .then((result) => {
        setOptions(result);
        if (!invoice && initialDealId) void applyDeal(initialDealId);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load billing options",
        ),
      )
      .finally(() => setLoading(false));
    // The initial deal is applied exactly once when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyDeal(nextDealId: string) {
    setDealId(nextDealId);
    setPrefillSource(null);
    if (!nextDealId) return;
    setLoadingPrefill(true);
    setError("");
    try {
      const result = await apiFetch<InvoicePrefillResponse>(
        "/billing/prefill?dealId=" + encodeURIComponent(nextDealId),
      );
      setContactId(result.deal.contact.id);
      setLines(result.lineItems.map((item) => makeLine(item)));
      setPrefillSource(result.source);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to pre-fill the deal",
      );
    } finally {
      setLoadingPrefill(false);
    }
  }

  function updateLine<K extends keyof InvoiceLineItem>(
    key: string,
    field: K,
    value: InvoiceLineItem[K],
  ) {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
    setPrefillSource(null);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload: InvoiceInput = {
      contactId,
      dealId: dealId || null,
      dueDate,
      lineItems: lines.map((line) => ({
        description: line.description,
        hsnSacCode: line.hsnSacCode,
        quantity: line.quantity,
        rate: line.rate,
        discountPercent: line.discountPercent ?? 0,
        taxPercent: line.taxPercent,
      })),
    };
    try {
      const result = await apiFetch<InvoiceDetail>(
        invoice ? "/billing/invoices/" + invoice.id : "/billing/invoices",
        {
          method: invoice ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      router.replace("/invoices/" + result.id);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save invoice",
      );
    } finally {
      setSaving(false);
    }
  }

  const totals = calculateTotals(lines);

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>
          {invoice ? "Edit draft invoice" : "Create invoice"}
        </CardTitle>
        <CardDescription>
          Totals are recalculated on the server. The invoice number is assigned
          only when the draft is issued.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          <section className="grid gap-5 border-b border-slate-200 pb-5 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-emerald-800">From</p>
              <h2 className="text-lg font-bold text-slate-950">
                {options?.company.name ?? "Your company"}
              </h2>
              {options?.company.email ? <p className="text-sm text-slate-600">{options.company.email}</p> : null}
              {options?.company.phone ? <p className="text-sm text-slate-600">{options.company.phone}</p> : null}
              {options?.company.gstin ? <p className="text-sm text-slate-600">GSTIN {options.company.gstin}</p> : null}
              {options?.company.stateCode ? <p className="text-sm text-slate-600">State code {options.company.stateCode}</p> : null}
            </div>
            <div className="sm:min-w-52 sm:text-right">
              <p className="text-xs font-semibold uppercase text-emerald-800">Billing number</p>
              <p className="mt-1 text-lg font-bold text-slate-950">
                {invoice?.invoiceNumber ?? (invoice ? `DRAFT-${invoice.id.slice(0, 8).toUpperCase()}` : "Assigned when issued")}
              </p>
              <p className="mt-1 text-sm text-slate-500">{invoice ? "Draft invoice" : "A permanent number is assigned on issue"}</p>
            </div>
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-deal">Create from deal (optional)</Label>
              <select
                className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary"
                disabled={loadingPrefill}
                id="invoice-deal"
                onChange={(event) => void applyDeal(event.target.value)}
                value={dealId}
              >
                <option value="">No linked deal</option>
                {options?.deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.title} · {deal.contactName}
                  </option>
                ))}
              </select>
              {loadingPrefill ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                  deal...
                </p>
              ) : prefillSource ? (
                <p className="text-xs font-medium text-emerald-700">
                  {prefillSource === "quotation"
                    ? "Line items copied from the latest quotation."
                    : "Contact and value copied from the deal."}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-contact">Customer</Label>
              <select
                className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary"
                id="invoice-contact"
                onChange={(event) => {
                  setContactId(event.target.value);
                  const selectedDeal = options?.deals.find(
                    (deal) => deal.id === dealId,
                  );
                  if (
                    selectedDeal &&
                    selectedDeal.contactId !== event.target.value
                  ) {
                    setDealId("");
                  }
                }}
                required
                value={contactId}
              >
                <option value="">Select customer</option>
                {options?.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} · {contact.phone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Bill to</p>
            <p className="mt-1 font-semibold text-slate-900">
              {options?.contacts.find((contact) => contact.id === contactId)?.name ?? "Select a customer"}
            </p>
            {options?.contacts.find((contact) => contact.id === contactId)?.phone ? (
              <p className="text-sm text-slate-600">{options.contacts.find((contact) => contact.id === contactId)?.phone}</p>
            ) : null}
          </div>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="invoice-due">Payment due date</Label>
            <Input
              id="invoice-due"
              min={todayDate()}
              onChange={(event) => setDueDate(event.target.value)}
              required
              type="date"
              value={dueDate}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Line items</h2>
                <p className="text-sm text-muted-foreground">
                  Add the HSN or SAC code and GST rate for every item.
                </p>
              </div>
              <Button
                onClick={() => setLines((current) => [...current, makeLine()])}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {lines.map((line, index) => (
                <article
                  className="rounded-lg border bg-slate-50 p-4"
                  key={line.key}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Item {index + 1}</p>
                    <Button
                      aria-label={"Remove item " + (index + 1)}
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.key)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                      <Label htmlFor={line.key + "-description"}>
                        Description
                      </Label>
                      <Input
                        id={line.key + "-description"}
                        maxLength={240}
                        minLength={2}
                        onChange={(event) =>
                          updateLine(
                            line.key,
                            "description",
                            event.target.value,
                          )
                        }
                        required
                        value={line.description}
                      />
                    </div>
                    <LineNumberField
                      id={line.key + "-hsn"}
                      label="HSN/SAC"
                      onChange={(value) =>
                        updateLine(line.key, "hsnSacCode", value)
                      }
                      text
                      value={line.hsnSacCode}
                    />
                    <LineNumberField
                      id={line.key + "-quantity"}
                      label="Qty"
                      min="0.001"
                      onChange={(value) =>
                        updateLine(line.key, "quantity", Number(value))
                      }
                      step="0.001"
                      value={String(line.quantity)}
                    />
                    <LineNumberField
                      id={line.key + "-rate"}
                      label="Rate (₹)"
                      min="0"
                      onChange={(value) =>
                        updateLine(line.key, "rate", Number(value))
                      }
                      step="0.01"
                      value={String(line.rate)}
                    />
                    <LineNumberField
                      id={line.key + "-discount"}
                      label="Discount %"
                      min="0"
                      onChange={(value) =>
                        updateLine(line.key, "discountPercent", Number(value))
                      }
                      step="0.01"
                      value={String(line.discountPercent ?? 0)}
                    />
                    <LineNumberField
                      id={line.key + "-tax"}
                      label="GST %"
                      min="0"
                      onChange={(value) =>
                        updateLine(line.key, "taxPercent", Number(value))
                      }
                      step="0.01"
                      value={String(line.taxPercent)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="ml-auto max-w-sm rounded-lg bg-emerald-50 p-4">
            <TotalRow label="Subtotal" value={totals.subtotal} />
            {totals.discountTotal > 0 ? (
              <TotalRow label="Discount" value={-totals.discountTotal} />
            ) : null}
            <TotalRow label="Taxable value" value={totals.taxableSubtotal} />
            <TotalRow label="GST" value={totals.taxTotal} />
            <div className="mt-3 border-t border-emerald-200 pt-3">
              <TotalRow label="Grand total" strong value={totals.grandTotal} />
            </div>
          </div>

          {options?.eInvoiceApplicable ? (
            <p className="flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              E-invoicing is enabled. IRN and QR details will be generated when
              this draft is issued.
            </p>
          ) : null}

          {error ? (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="outline">
              <Link href={invoice ? "/invoices/" + invoice.id : "/invoices"}>
                Cancel
              </Link>
            </Button>
            <Button
              disabled={saving || !contactId || !lines.length}
              type="submit"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {invoice ? "Save draft" : "Create draft"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LineNumberField({
  id,
  label,
  min,
  onChange,
  step,
  text = false,
  value,
}: {
  id: string;
  label: string;
  min?: string;
  onChange: (value: string) => void;
  step?: string;
  text?: boolean;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={text ? "text" : "decimal"}
        max={text ? undefined : "999999999999.99"}
        maxLength={text ? 12 : undefined}
        min={min}
        minLength={text ? 2 : undefined}
        onChange={(event) => onChange(event.target.value)}
        pattern={text ? "[A-Za-z0-9.-]{2,12}" : undefined}
        required
        step={step}
        type={text ? "text" : "number"}
        value={value}
      />
    </div>
  );
}

function TotalRow({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span
        className={
          strong ? "font-bold text-emerald-950" : "text-sm text-emerald-900"
        }
      >
        {label}
      </span>
      <span
        className={
          strong ? "text-lg font-bold text-emerald-950" : "font-semibold"
        }
      >
        {formatInr(value)}
      </span>
    </div>
  );
}

function calculateTotals(lines: InvoiceLineItem[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  lines.forEach((line) => {
    const base = round(line.quantity * line.rate);
    const discount = round((base * (line.discountPercent ?? 0)) / 100);
    const taxable = round(base - discount);
    subtotal += base;
    discountTotal += discount;
    taxTotal += round((taxable * line.taxPercent) / 100);
  });
  return {
    subtotal: round(subtotal),
    discountTotal: round(discountTotal),
    taxableSubtotal: round(subtotal - discountTotal),
    taxTotal: round(taxTotal),
    grandTotal: round(subtotal - discountTotal + taxTotal),
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function todayDate() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function defaultDueDate() {
  const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
