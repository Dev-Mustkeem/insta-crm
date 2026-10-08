"use client";

import { CONTACT_SOURCES, type ContactSource } from "@insta-crm/shared-types";
import { Loader2, Megaphone } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Campaign = {
  id: string;
  name: string;
  templateName: string;
  status: string;
  metrics: {
    deliveryRate: number;
    readRate: number;
    SKIPPED_OPT_OUT?: number;
  };
};

export default function BroadcastsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [tag, setTag] = useState("");
  const [source, setSource] = useState<ContactSource | "">("");
  const [parameters, setParameters] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setCampaigns(await apiFetch<Campaign[]>("/broadcasts"));
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      await apiFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          name,
          templateName,
          templateLanguage: "en_US",
          parameters: parameters.split(",").map((item) => item.trim()).filter(Boolean),
          ...(tag ? { tag } : {}),
          ...(source ? { source } : {}),
        }),
      });
      setName("");
      setTemplateName("");
      setTag("");
      setParameters("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send broadcast");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp broadcasts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send approved templates to a focused segment. Opted-out contacts are skipped.</p>
      </div>
      <form className="grid gap-3 rounded-lg border bg-white p-4 shadow-sm sm:grid-cols-2" onSubmit={submit}>
        <Input onChange={(event) => setName(event.target.value)} placeholder="Campaign name" required value={name} />
        <Input onChange={(event) => setTemplateName(event.target.value)} placeholder="Approved template name" required value={templateName} />
        <Input onChange={(event) => setTag(event.target.value)} placeholder="Tag filter (optional)" value={tag} />
        <select className="h-11 rounded-md border bg-white px-3 text-sm" onChange={(event) => setSource(event.target.value as ContactSource | "")} value={source}>
          <option value="">All sources</option>
          {CONTACT_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Input className="sm:col-span-2" onChange={(event) => setParameters(event.target.value)} placeholder="Template parameters, comma separated" value={parameters} />
        {error ? <p className="sm:col-span-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <Button className="sm:col-span-2" disabled={sending} type="submit">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
          Send broadcast
        </Button>
      </form>
      <div className="grid gap-3">
        {campaigns.map((campaign) => (
          <article className="rounded-lg border bg-white p-4 shadow-sm" key={campaign.id}>
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{campaign.name}</h2><span className="text-xs uppercase text-muted-foreground">{campaign.status}</span></div>
            <p className="mt-1 text-sm text-muted-foreground">{campaign.templateName}</p>
            <div className="mt-3 flex gap-4 text-xs"><span>Delivered {campaign.metrics.deliveryRate}%</span><span>Read {campaign.metrics.readRate}%</span><span>Opted out {campaign.metrics.SKIPPED_OPT_OUT ?? 0}</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}
