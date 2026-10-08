"use client";

import type { ContactSummary } from "@insta-crm/shared-types";
import { MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  contactInitials,
  contactSourceLabels,
  whatsappHref,
} from "@/lib/contacts";
import { cn } from "@/lib/utils";

export function ContactCard({ contact }: { contact: ContactSummary }) {
  const touchStart = useRef<number | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <article className="relative overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="absolute inset-y-0 right-0 flex w-28">
        <a
          aria-label={"Call " + contact.name}
          className="grid min-h-12 w-14 place-items-center bg-sky-600 text-white"
          href={"tel:" + contact.phone}
          tabIndex={actionsOpen ? 0 : -1}
        >
          <Phone className="h-5 w-5" />
        </a>
        <a
          aria-label={"Message " + contact.name + " on WhatsApp"}
          className="grid min-h-12 w-14 place-items-center bg-emerald-600 text-white"
          href={whatsappHref(contact.phone)}
          rel="noreferrer"
          tabIndex={actionsOpen ? 0 : -1}
          target="_blank"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      </div>

      <div
        className={cn(
          "relative flex min-h-24 items-center gap-3 bg-white p-3 transition-transform duration-200",
          actionsOpen && "-translate-x-28",
        )}
        onTouchStart={(event) => {
          touchStart.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance =
            (event.changedTouches[0]?.clientX ?? touchStart.current) -
            touchStart.current;
          if (distance < -40) setActionsOpen(true);
          if (distance > 40) setActionsOpen(false);
          touchStart.current = null;
        }}
      >
        <Link
          aria-label={"Open " + contact.name}
          className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          href={"/contacts/" + contact.id}
        />
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
          {contactInitials(contact.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{contact.name}</h2>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="Lead score">
              Score {contact.leadScore}
            </span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {contactSourceLabels[contact.source]}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {contact.phone}
            {contact.email ? " · " + contact.email : ""}
          </p>
          {contact.tags.length ? (
            <div className="mt-2 flex gap-1.5 overflow-hidden">
              {contact.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400 sm:hidden">
              Swipe left for call and WhatsApp
            </p>
          )}
        </div>

        <div className="relative z-10 hidden shrink-0 items-center gap-1 sm:flex">
          <a
            aria-label={"Call " + contact.name}
            className="grid h-11 w-11 place-items-center rounded-full text-sky-700 hover:bg-sky-50"
            href={"tel:" + contact.phone}
          >
            <Phone className="h-5 w-5" />
          </a>
          <a
            aria-label={"Message " + contact.name + " on WhatsApp"}
            className="grid h-11 w-11 place-items-center rounded-full text-emerald-700 hover:bg-emerald-50"
            href={whatsappHref(contact.phone)}
            rel="noreferrer"
            target="_blank"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        </div>
      </div>
    </article>
  );
}
