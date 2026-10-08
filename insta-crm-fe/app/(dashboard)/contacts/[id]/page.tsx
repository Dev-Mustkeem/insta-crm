"use client";

import type { ContactSummary } from "@insta-crm/shared-types";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Loader2,
  Mail,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContactConversations } from "@/components/inbox/contact-conversations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactDeals } from "@/components/pipeline/contact-deals";
import { EntityTasks } from "@/components/tasks/entity-tasks";
import { apiFetch } from "@/lib/api";
import {
  contactInitials,
  contactSourceLabels,
  whatsappHref,
} from "@/lib/contacts";
import { cn } from "@/lib/utils";

type Tab = "conversation" | "deals";

export default function ContactDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [contact, setContact] = useState<ContactSummary | null>(null);
  const [tab, setTab] = useState<Tab>("conversation");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch<ContactSummary>("/contacts/" + params.id)
      .then(setContact)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load contact",
        ),
      );
  }, [params.id]);

  async function removeContact() {
    if (!contact) return;
    if (
      !window.confirm(
        "Delete " +
          contact.name +
          "? This contact will be moved out of active records.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch("/contacts/" + contact.id, { method: "DELETE" });
      router.replace("/contacts");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete contact",
      );
      setDeleting(false);
    }
  }

  if (error && !contact) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-red-700" role="alert">
          {error}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/contacts">Back to contacts</Link>
        </Button>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const customFields = Object.entries(contact.customFields);

  return (
    <section>
      <Link
        className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/contacts"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Contacts
      </Link>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-800">
              {contactInitials(contact.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-bold tracking-tight">
                  {contact.name}
                </h1>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {contactSourceLabels[contact.source]}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Added by {contact.createdBy.name} · Updated{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(contact.updatedAt))}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
            <Button asChild>
              <a href={"tel:" + contact.phone}>
                <Phone className="mr-2 h-4 w-4" /> Call
              </a>
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <a href={whatsappHref(contact.phone)} rel="noreferrer" target="_blank">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
            {contact.email ? (
              <Button asChild variant="outline">
                <Link href={`/gmail?contactId=${encodeURIComponent(contact.id)}`}>
                  <Mail className="mr-2 h-4 w-4" /> Email conversation
                </Link>
              </Button>
            ) : null}
            <Button asChild className="col-span-2" variant="outline">
              <Link href={"/contacts/" + contact.id + "/edit"}>
                <Pencil className="mr-2 h-4 w-4" /> Edit contact
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

          <dl className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Phone
              </dt>
              <dd className="mt-1 font-medium">{contact.phone}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 min-w-0">
                {contact.email ? (
                  <a
                    className="inline-flex items-center break-all font-medium text-primary hover:underline"
                    href={"mailto:" + contact.email}
                  >
                    <Mail className="mr-2 h-4 w-4 shrink-0" /> {contact.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not added</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assigned to
              </dt>
              <dd className="mt-1 font-medium">{contact.assignedTo.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Credit terms
              </dt>
              <dd className="mt-1 font-medium">
                {contact.creditTermsDays} days
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                GSTIN
              </dt>
              <dd className="mt-1 font-medium">
                {contact.gstin ?? "Not added"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Place of supply
              </dt>
              <dd className="mt-1 font-medium">
                {contact.billingStateCode ?? "Not added"}
              </dd>
            </div>
          </dl>

          {contact.tags.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {contact.tags.map((tag) => (
                <span
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {customFields.length ? (
            <div className="mt-6 border-t pt-5">
              <h2 className="font-semibold">Custom fields</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {customFields.map(([key, value]) => (
                  <div className="rounded-md bg-slate-50 p-3" key={key}>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {key}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-medium">
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <div className="grid grid-cols-2 border-b p-1">
          <TabButton
            active={tab === "conversation"}
            icon={MessagesSquare}
            label="Conversation"
            onClick={() => setTab("conversation")}
          />
          <TabButton
            active={tab === "deals"}
            icon={BriefcaseBusiness}
            label="Deals"
            onClick={() => setTab("deals")}
          />
        </div>
        <CardContent className="px-5 py-6">
          {tab === "conversation" ? (
            <ContactConversations contactId={contact.id} />
          ) : (
            <ContactDeals contactId={contact.id} />
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        <EntityTasks entityId={contact.id} entityType="contact" />
      </div>

      <div className="mt-6 flex justify-end">
        <Button disabled={deleting} onClick={removeContact} variant="ghost">
          {deleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
          )}
          <span className="text-red-700">Delete contact</span>
        </Button>
      </div>
    </section>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessagesSquare;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold text-muted-foreground",
        active && "bg-emerald-50 text-primary",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
