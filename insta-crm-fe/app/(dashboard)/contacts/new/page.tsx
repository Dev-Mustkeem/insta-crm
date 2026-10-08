import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "@/components/contacts/contact-form";

export default function NewContactPage() {
  return (
    <section>
      <Link
        className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/contacts"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to contacts
      </Link>
      <ContactForm mode="create" />
    </section>
  );
}
