"use client";

import type {
  ContactListResponse,
  ContactSummary,
  DealInput,
  DealSummary,
  PipelineOptionsResponse,
} from "@insta-crm/shared-types";
import { Loader2, ReceiptIndianRupee, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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

type ContactOption = Pick<ContactSummary, "id" | "name" | "phone">;

export function DealForm({
  deal,
  initialContactId,
  mode,
}: {
  deal?: DealSummary;
  initialContactId?: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [options, setOptions] = useState<PipelineOptionsResponse | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>(
    deal ? [deal.contact] : [],
  );
  const [title, setTitle] = useState(deal?.title ?? "");
  const [value, setValue] = useState(deal ? String(deal.value) : "");
  const [contactId, setContactId] = useState(
    deal?.contact.id ?? initialContactId ?? "",
  );
  const [assignedToId, setAssignedToId] = useState(deal?.assignedTo.id ?? "");
  const [stageId, setStageId] = useState(deal?.stage.id ?? "");
  const [contactSearch, setContactSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<PipelineOptionsResponse>("/pipeline/options")
      .then((response) => {
        setOptions(response);
        setStageId((current) => current || response.stages[0]?.id || "");
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load pipeline",
        ),
      );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams({ limit: "100" });
      if (contactSearch.trim()) {
        parameters.set("search", contactSearch.trim());
      }
      apiFetch<ContactListResponse>("/contacts?" + parameters.toString(), {
        signal: controller.signal,
      })
        .then((response) => {
          const next = response.items.map(({ id, name, phone }) => ({
            id,
            name,
            phone,
          }));
          if (deal && !next.some((contact) => contact.id === deal.contact.id)) {
            next.unshift(deal.contact);
          }
          setContacts(next);
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") {
            return;
          }
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load contacts",
          );
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [contactSearch, deal]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const payload: DealInput = {
      title,
      value: Number(value),
      contactId,
      ...(assignedToId ? { assignedToId } : {}),
      ...(mode === "create" && stageId ? { stageId } : {}),
    };
    try {
      await apiFetch<DealSummary>(
        mode === "create" ? "/deals" : "/deals/" + deal?.id,
        {
          method: mode === "create" ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      router.replace("/pipeline");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save deal",
      );
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!deal) return;
    if (
      !window.confirm(
        "Delete " +
          deal.title +
          "? It will be removed from the active pipeline.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await apiFetch("/deals/" + deal.id, { method: "DELETE" });
      router.replace("/pipeline");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete deal",
      );
      setDeleting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{mode === "create" ? "Add deal" : "Edit deal"}</CardTitle>
        <CardDescription>
          Link the opportunity to a contact, owner, value, and pipeline stage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="deal-title" label="Deal title">
              <Input
                autoFocus
                id="deal-title"
                maxLength={120}
                minLength={2}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Annual service contract"
                required
                value={title}
              />
            </Field>
            <Field id="deal-value" label="Value (₹)">
              <Input
                id="deal-value"
                inputMode="decimal"
                min="0"
                onChange={(event) => setValue(event.target.value)}
                placeholder="50000"
                required
                step="0.01"
                type="number"
                value={value}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-search">Contact</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <Input
                className="pl-10"
                id="contact-search"
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search contacts, then choose below"
                value={contactSearch}
              />
            </div>
            <select
              aria-label="Select contact"
              className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              onChange={(event) => setContactId(event.target.value)}
              required
              value={contactId}
            >
              <option value="">Select a contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} · {contact.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="assignee" label="Assigned to">
              <select
                className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                id="assignee"
                onChange={(event) => setAssignedToId(event.target.value)}
                value={assignedToId}
              >
                <option value="">Assign to me</option>
                {options?.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Field>
            {mode === "create" ? (
              <Field id="stage" label="Starting stage">
                <select
                  className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  id="stage"
                  onChange={(event) => setStageId(event.target.value)}
                  required
                  value={stageId}
                >
                  {options?.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-medium">Stage: {deal?.stage.name}</p>
                <p className="mt-1 text-muted-foreground">
                  Move stages from the board or mobile dropdown so the change is
                  logged.
                </p>
              </div>
            )}
          </div>

          {error ? (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {deal ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  disabled={deleting}
                  onClick={remove}
                  type="button"
                  variant="ghost"
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                  )}
                  <span className="text-red-700">Delete deal</span>
                </Button>
                <Button asChild variant="outline">
                  <Link href={"/invoices/new?dealId=" + deal.id}>
                    <ReceiptIndianRupee className="mr-2 h-4 w-4" /> Create
                    invoice
                  </Link>
                </Button>
              </div>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button asChild variant="outline">
                <Link href="/pipeline">Cancel</Link>
              </Button>
              <Button
                disabled={
                  loading ||
                  !options ||
                  !contactId ||
                  (mode === "create" && !stageId)
                }
                type="submit"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {mode === "create" ? "Add deal" : "Save changes"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
