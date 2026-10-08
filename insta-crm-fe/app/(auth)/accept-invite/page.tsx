import { Suspense } from "react";
import { AcceptInvitation } from "@/components/users/accept-invitation";

/** Renders the public invitation acceptance experience. */
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-slate-500">Loading invitation...</p>}>
      <AcceptInvitation />
    </Suspense>
  );
}
