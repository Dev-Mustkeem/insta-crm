"use client";

import type {
  AuthResponse,
  BusinessType,
  CompleteBusinessSetupInput,
} from "@insta-crm/shared-types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheckBig,
  Loader2,
  UserRoundPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const businessTypes: { label: string; value: BusinessType }[] = [
  { label: "Retailer", value: "retailer" },
  { label: "Service provider", value: "service" },
  { label: "Distributor", value: "distributor" },
  { label: "Manufacturer", value: "manufacturer" },
];

const teamSizes = [
  { label: "Just me", value: 1 },
  { label: "2–5 people", value: 5 },
  { label: "6–10 people", value: 10 },
  { label: "11–25 people", value: 25 },
  { label: "26+ people", value: 26 },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Pick<AuthResponse, "user" | "business">>("/auth/me")
      .then((session) => {
        if (session.business.onboardingCompletedAt)
          router.replace("/dashboard");
        else setChecking(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function finish() {
    if (!businessType || !teamSize) return;
    setSaving(true);
    setError("");
    try {
      const payload: CompleteBusinessSetupInput = { businessType, teamSize };
      await apiFetch("/business/setup", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save setup",
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking) return <FullPageLoader />;

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_#d1fae5,_transparent_45%),#f8fafc] px-4 py-6 sm:grid sm:place-items-center sm:py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CircleCheckBig className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">Insta CRM</span>
        </div>

        <Card>
          <CardHeader>
            <div className="mb-4 flex gap-2" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((item) => (
                <span
                  key={item}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    item <= step ? "bg-primary" : "bg-slate-200",
                  )}
                />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Step {step} of 3
            </p>
            <CardTitle>
              {step === 1 && "What kind of business do you run?"}
              {step === 2 && "How big is your team?"}
              {step === 3 && "Ready for your first contact?"}
            </CardTitle>
            <CardDescription>
              {step === 1 &&
                "We’ll use this to choose sensible defaults later."}
              {step === 2 && "A quick estimate is perfect."}
              {step === 3 &&
                "Your workspace is ready. Adding a contact is the best next step."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === 1 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="business-type">
                  Business type
                </label>
                <select
                  className="h-12 w-full rounded-md border bg-white px-3 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  id="business-type"
                  onChange={(event) =>
                    setBusinessType(event.target.value as BusinessType | "")
                  }
                  value={businessType}
                >
                  <option value="">Select your business type</option>
                  {businessTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {step === 2 ? (
              <div
                className="grid gap-2"
                role="radiogroup"
                aria-label="Team size"
              >
                {teamSizes.map((option) => (
                  <Choice
                    key={option.value}
                    active={teamSize === option.value}
                    label={option.label}
                    onClick={() => setTeamSize(option.value)}
                  />
                ))}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-primary shadow-sm">
                  <UserRoundPlus className="h-6 w-6" />
                </span>
                <p className="mt-3 font-semibold">Add your first contact</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  We’ll take you to your workspace, where Contacts is ready for
                  your first customer or lead.
                </p>
              </div>
            ) : null}

            {error ? (
              <p
                className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              {step > 1 ? (
                <Button
                  className="flex-1"
                  disabled={saving}
                  onClick={() => setStep((current) => current - 1)}
                  type="button"
                  variant="outline"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : null}
              {step < 3 ? (
                <Button
                  className="flex-1"
                  disabled={step === 1 ? !businessType : !teamSize}
                  onClick={() => setStep((current) => current + 1)}
                  type="button"
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={saving}
                  onClick={finish}
                  type="button"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Go to dashboard
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Choice({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={cn(
        "flex min-h-12 w-full items-center justify-between rounded-md border bg-white px-4 py-3 text-left font-medium outline-none transition focus:ring-2 focus:ring-primary/30",
        active && "border-primary bg-emerald-50 text-emerald-900",
      )}
      onClick={onClick}
      role="radio"
      type="button"
    >
      {label}
      {active ? <Check className="h-5 w-5 text-primary" /> : null}
    </button>
  );
}

function FullPageLoader() {
  return (
    <main
      className="grid min-h-dvh place-items-center bg-background"
      aria-label="Loading workspace"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </main>
  );
}
