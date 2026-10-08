"use client";

import type {
  WhatsAppSettings,
  WhatsAppSettingsInput,
} from "@insta-crm/shared-types";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

const emptyForm: WhatsAppSettingsInput = {
  phoneNumberId: "",
  displayPhoneNumber: "",
  apiKey: "",
  reminderTemplateName: "",
  reminderTemplateLanguage: "en_US",
  digestTemplateName: "",
  digestTemplateLanguage: "en_US",
  enabled: true,
};

export function WhatsAppSettingsForm() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [form, setForm] = useState<WhatsAppSettingsInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<WhatsAppSettings>("/whatsapp/settings")
      .then((value) => {
        setSettings(value);
        setForm({
          phoneNumberId: value.phoneNumberId ?? "",
          displayPhoneNumber: value.displayPhoneNumber ?? "",
          apiKey: "",
          reminderTemplateName: value.reminderTemplateName ?? "",
          reminderTemplateLanguage: value.reminderTemplateLanguage,
          digestTemplateName: value.digestTemplateName ?? "",
          digestTemplateLanguage: value.digestTemplateLanguage,
          enabled: value.enabled,
        });
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load WhatsApp settings",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof WhatsAppSettingsInput>(
    key: K,
    value: WhatsAppSettingsInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = { ...form };
      if (!payload.apiKey?.trim()) delete payload.apiKey;
      payload.reminderTemplateName =
        payload.reminderTemplateName?.trim() || null;
      payload.digestTemplateName = payload.digestTemplateName?.trim() || null;
      const result = await apiFetch<WhatsAppSettings>("/whatsapp/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSettings(result);
      setForm((current) => ({ ...current, apiKey: "" }));
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save WhatsApp settings",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">360dialog connection</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect the official WhatsApp number used by this business.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor="phone-number-id">Phone number ID</Label>
              <Input
                id="phone-number-id"
                inputMode="numeric"
                onChange={(event) =>
                  update("phoneNumberId", event.target.value)
                }
                placeholder="From your 360dialog channel"
                required
                value={form.phoneNumberId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display-number">WhatsApp phone number</Label>
              <Input
                id="display-number"
                onChange={(event) =>
                  update("displayPhoneNumber", event.target.value)
                }
                placeholder="For example, +91 98765 43210"
                required
                value={form.displayPhoneNumber}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">
                360dialog API key
                {settings?.configured ? " (leave blank to keep it)" : ""}
              </Label>
              <Input
                autoComplete="new-password"
                id="api-key"
                onChange={(event) => update("apiKey", event.target.value)}
                placeholder={
                  settings?.configured
                    ? "Saved securely"
                    : "Paste the channel API key"
                }
                required={!settings?.configured}
                type="password"
                value={form.apiKey ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                The key is encrypted before it is saved and is never shown
                again.
              </p>
            </div>

            <div className="border-t pt-5">
              <h3 className="font-semibold">Follow-up reminder template</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional. This approved template is used by the daily reminder
                job.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem]">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template name</Label>
                  <Input
                    id="template-name"
                    onChange={(event) =>
                      update("reminderTemplateName", event.target.value)
                    }
                    placeholder="task_follow_up_reminder"
                    value={form.reminderTemplateName ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-language">Language</Label>
                  <Input
                    id="template-language"
                    onChange={(event) =>
                      update("reminderTemplateLanguage", event.target.value)
                    }
                    placeholder="en_US"
                    required
                    value={form.reminderTemplateLanguage}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Use parameter {"{{1}}"} for the task title and {"{{2}}"} for the
                due time.
              </p>
            </div>

            <div className="border-t pt-5">
              <h3 className="font-semibold">Owner dashboard digest</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional. This approved template sends the daily and Monday
                owner summary at 9 AM business time.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem]">
                <div className="space-y-2">
                  <Label htmlFor="digest-template-name">Template name</Label>
                  <Input
                    id="digest-template-name"
                    onChange={(event) =>
                      update("digestTemplateName", event.target.value)
                    }
                    placeholder="owner_dashboard_digest"
                    value={form.digestTemplateName ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="digest-template-language">Language</Label>
                  <Input
                    id="digest-template-language"
                    onChange={(event) =>
                      update("digestTemplateLanguage", event.target.value)
                    }
                    placeholder="en_US"
                    required
                    value={form.digestTemplateLanguage}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Use one body parameter, {"{{1}}"}, for the complete digest.
              </p>
            </div>

            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-md border p-3">
              <span>
                <span className="block text-sm font-semibold">
                  Connection enabled
                </span>
                <span className="block text-xs text-muted-foreground">
                  Pause sending without removing the saved connection.
                </span>
              </span>
              <input
                checked={form.enabled}
                className="h-5 w-5 accent-emerald-600"
                onChange={(event) => update("enabled", event.target.checked)}
                type="checkbox"
              />
            </label>

            {error ? (
              <p
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {saved ? (
              <p
                className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                role="status"
              >
                <CheckCircle2 className="h-4 w-4" /> WhatsApp settings saved.
              </p>
            ) : null}

            <Button
              className="w-full sm:w-auto"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save connection
            </Button>
          </form>
        </CardContent>
      </Card>

      <aside className="h-fit rounded-lg border bg-slate-950 p-5 text-white">
        <h2 className="font-semibold">Webhook setup</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          In 360dialog, set the channel webhook URL to your public API address
          followed by:
        </p>
        <code className="mt-3 block break-all rounded-md bg-white/10 p-3 text-xs text-emerald-300">
          /api/webhooks/360dialog
        </code>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Add a custom <strong className="text-white">Authorization</strong>{" "}
          header with the value{" "}
          <strong className="text-white">Bearer + your webhook token</strong>.
          The token comes from the API environment settings.
        </p>
        <p className="mt-4 rounded-md bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
          Only business owners can change this connection.
        </p>
      </aside>
    </div>
  );
}
