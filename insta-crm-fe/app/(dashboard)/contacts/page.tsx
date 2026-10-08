"use client";

import type {
  ContactListResponse,
  ContactSource,
} from "@insta-crm/shared-types";
import { FilterX, Loader2, Plus, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactCard } from "@/components/contacts/contact-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { CONTACT_SOURCE_OPTIONS, contactSourceLabels } from "@/lib/contacts";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<ContactSource | "">("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ContactListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      if (search.trim()) parameters.set("search", search.trim());
      if (source) parameters.set("source", source);
      if (tag.trim()) parameters.set("tag", tag.trim().toLowerCase());

      setLoading(true);
      setError("");
      apiFetch<ContactListResponse>("/contacts?" + parameters.toString(), {
        signal: controller.signal,
      })
        .then(setData)
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") {
            return;
          }
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load contacts",
          );
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, source, tag]);

  const hasFilters = Boolean(search || source || tag);

  return (
    <section aria-labelledby="contacts-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            id="contacts-heading"
          >
            Contacts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? data.meta.total + " active contacts"
              : "Customers and leads in one place"}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/contacts/new">
            <Plus className="mr-1.5 h-4 w-4" />
            <span className="hidden min-[380px]:inline">Add contact</span>
            <span className="min-[380px]:hidden">Add</span>
          </Link>
        </Button>
      </div>

      <div className="mt-5 rounded-lg border bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
          <Input
            aria-label="Search contacts"
            className="pl-10"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, phone, or email"
            value={search}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select
            aria-label="Filter by source"
            className="h-11 min-w-0 rounded-md border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            onChange={(event) => {
              setSource(event.target.value as ContactSource | "");
              setPage(1);
            }}
            value={source}
          >
            <option value="">All sources</option>
            {CONTACT_SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {contactSourceLabels[option]}
              </option>
            ))}
          </select>
          <Input
            aria-label="Filter by tag"
            className="h-11"
            onChange={(event) => {
              setTag(event.target.value);
              setPage(1);
            }}
            placeholder="Filter tag"
            value={tag}
          />
          {hasFilters ? (
            <Button
              className="col-span-2 sm:col-span-1"
              onClick={() => {
                setSearch("");
                setSource("");
                setTag("");
                setPage(1);
              }}
              type="button"
              variant="ghost"
            >
              <FilterX className="mr-2 h-4 w-4" /> Clear filters
            </Button>
          ) : null}
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

      {loading && !data ? (
        <div className="grid min-h-64 place-items-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : data?.items.length ? (
        <>
          <div className="mt-4 grid gap-3">
            {data.items.map((contact) => (
              <ContactCard contact={contact} key={contact.id} />
            ))}
          </div>
          {data.meta.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.meta.page} of {data.meta.totalPages}
              </span>
              <Button
                disabled={page >= data.meta.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed bg-white px-5 py-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-primary">
            <UsersRound className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-semibold">
            {hasFilters
              ? "No contacts match these filters"
              : "Add your first contact"}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            {hasFilters
              ? "Try a different search, source, or tag."
              : "Keep customer and lead details ready for calls, WhatsApp, deals, and follow-ups."}
          </p>
          {!hasFilters ? (
            <Button asChild className="mt-5">
              <Link href="/contacts/new">
                <Plus className="mr-2 h-4 w-4" /> Add contact
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
