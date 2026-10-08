import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { WhatsAppSettingsForm } from "@/components/inbox/whatsapp-settings";

export default function WhatsAppSettingsPage() {
  return (
    <section>
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/inbox"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Team inbox
      </Link>
      <div className="mb-5 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect 360dialog once for this business and control automated
          reminders.
        </p>
      </div>
      <WhatsAppSettingsForm />
    </section>
  );
}
