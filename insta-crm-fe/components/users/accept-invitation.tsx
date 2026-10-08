"use client";

import type { OrganizationInvitationDetails } from "@insta-crm/shared-types";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

/** Invitation acceptance form for new organization users. */
export function AcceptInvitation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [invitation, setInvitation] = useState<OrganizationInvitationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("The invitation link is incomplete.");
      setLoadingDetails(false);
      return;
    }
    apiFetch<OrganizationInvitationDetails>(`/users/invitations/details?token=${encodeURIComponent(token)}`)
      .then(setInvitation)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Invitation is invalid or has expired"))
      .finally(() => setLoadingDetails(false));
  }, [token]);

  /** Creates the invited account and sends the user to sign in. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/users/invitations/accept", {
        method: "POST",
        body: JSON.stringify({
          token,
          name: form.get("name"),
          phone: form.get("phone"),
          password: form.get("password"),
        }),
      });
      setAccepted(true);
      setTimeout(() => router.replace("/login"), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept invitation");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingDetails) {
    return <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#0057A8]" /></div>;
  }

  if (accepted) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#00A651]" />
        <h1 className="text-2xl font-bold text-slate-900">Account created</h1>
        <p className="text-sm text-slate-500">Your organization account is ready. Redirecting you to sign in.</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Invitation unavailable</h1>
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="text-sm font-semibold text-[#0057A8] hover:underline">Return to sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Join {invitation.organizationName}</h1>
        <p className="mt-2 text-sm text-slate-500">Create your account for <strong>{invitation.email}</strong>.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required minLength={2} maxLength={100} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" name="phone" required minLength={7} maxLength={20} autoComplete="tel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-[#00A651] hover:bg-[#008f45]">
          {submitting ? "Creating account..." : "Accept invitation"}
        </Button>
      </form>
    </div>
  );
}
