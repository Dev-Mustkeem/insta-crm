"use client";

import type { ContactSummary } from "@insta-crm/shared-types";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ContactForm } from "@/components/contacts/contact-form";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function EditContactPage({
  params,
}: {
  params: { id: string };
}) {
  const [contact, setContact] = useState<ContactSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ContactSummary>("/contacts/" + params.id)
      .then(setContact)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load contact",
        ),
      );
  }, [params.id]);

  if (error) {
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

  return (
    <section>
      <Link
        className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href={"/contacts/" + contact.id}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to contact
      </Link>
      <ContactForm contact={contact} mode="edit" />
    </section>
  );
}
