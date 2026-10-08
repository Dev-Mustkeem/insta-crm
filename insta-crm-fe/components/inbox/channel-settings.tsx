"use client";

import type {
  ChannelSettings,
  ChannelSettingsInput,
} from "@insta-crm/shared-types";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const empty: ChannelSettingsInput = {
  smsMessageVariable: "message",
  smsEnabled: false,
  emailEnabled: false,
};

export function ChannelSettingsForm() {
  const t = useTranslations("Channels");
  const [settings, setSettings] = useState<ChannelSettings | null>(null);
  const [form, setForm] = useState<ChannelSettingsInput>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ChannelSettings>("/channels/settings")
      .then((value) => {
        setSettings(value);
        setForm({
          smsFlowId: value.sms.flowId,
          smsSenderId: value.sms.senderId,
          smsMessageVariable: value.sms.messageVariable,
          smsEnabled: value.sms.enabled,
          resendFromName: value.email.fromName,
          resendFromEmail: value.email.fromEmail,
          resendReceivingAddress: value.email.receivingAddress,
          emailEnabled: value.email.enabled,
        });
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load settings",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const value = await apiFetch<ChannelSettings>("/channels/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSettings(value);
      setForm((current) => ({
        ...current,
        smsAuthKey: undefined,
        smsWebhookToken: undefined,
        resendApiKey: undefined,
        resendWebhookSecret: undefined,
      }));
      setMessage(t("saved"));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/inbox/settings">WhatsApp settings</Link>
        </Button>
      </div>
      <form className="space-y-5" onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>{t("sms")}</CardTitle>
            <CardDescription>
              Use an approved MSG91 Flow template. Credentials are encrypted at
              rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="MSG91 auth key">
              <Input
                autoComplete="off"
                onChange={(e) =>
                  setForm((v) => ({ ...v, smsAuthKey: e.target.value }))
                }
                placeholder={
                  settings?.sms.configured
                    ? "Leave blank to keep current key"
                    : "Required"
                }
                type="password"
                value={form.smsAuthKey ?? ""}
              />
            </Field>
            <Field label="Flow / template ID">
              <Input
                onChange={(e) =>
                  setForm((v) => ({ ...v, smsFlowId: e.target.value }))
                }
                value={form.smsFlowId ?? ""}
              />
            </Field>
            <Field label="Sender ID">
              <Input
                onChange={(e) =>
                  setForm((v) => ({ ...v, smsSenderId: e.target.value }))
                }
                value={form.smsSenderId ?? ""}
              />
            </Field>
            <Field label="Message variable">
              <Input
                onChange={(e) =>
                  setForm((v) => ({ ...v, smsMessageVariable: e.target.value }))
                }
                value={form.smsMessageVariable}
              />
            </Field>
            <Field label="Inbound webhook token">
              <Input
                autoComplete="off"
                onChange={(e) =>
                  setForm((v) => ({ ...v, smsWebhookToken: e.target.value }))
                }
                placeholder={
                  settings?.sms.configured
                    ? "Leave blank to keep current token"
                    : "Create a long random token"
                }
                type="password"
                value={form.smsWebhookToken ?? ""}
              />
            </Field>
            <Field label="MSG91 inbound webhook URL">
              <Input
                readOnly
                value={
                  settings?.sms.webhookConnectionId
                    ? `${API_URL}/channels/webhooks/sms/${settings.sms.webhookConnectionId}`
                    : "Save once to generate URL"
                }
              />
            </Field>
            <Toggle
              checked={form.smsEnabled}
              label={t("enabled")}
              onChange={(checked) =>
                setForm((v) => ({ ...v, smsEnabled: checked }))
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("email")}</CardTitle>
            <CardDescription>
              Use a verified Resend sender and route inbound mail to your Resend
              receiving address.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Resend API key">
              <Input
                autoComplete="off"
                onChange={(e) =>
                  setForm((v) => ({ ...v, resendApiKey: e.target.value }))
                }
                placeholder={
                  settings?.email.configured
                    ? "Leave blank to keep current key"
                    : "Required"
                }
                type="password"
                value={form.resendApiKey ?? ""}
              />
            </Field>
            <Field label="From name">
              <Input
                onChange={(e) =>
                  setForm((v) => ({ ...v, resendFromName: e.target.value }))
                }
                value={form.resendFromName ?? ""}
              />
            </Field>
            <Field label="Verified from email">
              <Input
                onChange={(e) =>
                  setForm((v) => ({ ...v, resendFromEmail: e.target.value }))
                }
                type="email"
                value={form.resendFromEmail ?? ""}
              />
            </Field>
            <Field label="Resend receiving address">
              <Input
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    resendReceivingAddress: e.target.value,
                  }))
                }
                type="email"
                value={form.resendReceivingAddress ?? ""}
              />
            </Field>
            <Field label="Webhook signing secret">
              <Input
                autoComplete="off"
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    resendWebhookSecret: e.target.value,
                  }))
                }
                placeholder={
                  settings?.email.configured
                    ? "Leave blank to keep current secret"
                    : "whsec_…"
                }
                type="password"
                value={form.resendWebhookSecret ?? ""}
              />
            </Field>
            <Field label="Resend webhook URL">
              <Input readOnly value={`${API_URL}/channels/webhooks/resend`} />
            </Field>
            <Toggle
              checked={form.emailEnabled}
              label={t("enabled")}
              onChange={(checked) =>
                setForm((v) => ({ ...v, emailEnabled: checked }))
              }
            />
          </CardContent>
        </Card>
        {error ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button disabled={saving} type="submit">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save channel settings
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-md border px-3">
      <input
        checked={checked}
        className="h-5 w-5 accent-emerald-600"
        onChange={(e) => onChange(e.target.checked)}
        type="checkbox"
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}
