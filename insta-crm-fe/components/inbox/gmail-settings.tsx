"use client";

import { CheckCircle2, Loader2, Mail, Unplug } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type SmtpSettings = {
  configured: boolean;
  senderEmail: string;
  host: string;
  port: number;
  security: "SSL_TLS" | "STARTTLS";
  username: string;
  passwordConfigured: boolean;
  canEdit: boolean;
  testSucceeded?: boolean;
};

export function SmtpSettingsForm() {
  const [settings, setSettings] = useState<SmtpSettings | null>(null);
  const [senderEmail, setSenderEmail] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [security, setSecurity] = useState<"SSL_TLS" | "STARTTLS">("STARTTLS");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<SmtpSettings>("/gmail/smtp-settings")
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setSenderEmail(value.senderEmail);
        setHost(value.host);
        setPort(String(value.port));
        setSecurity(value.security);
        setUsername(value.username);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load email settings");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const value = await apiFetch<SmtpSettings>("/gmail/smtp-settings", {
        method: "PUT",
        body: JSON.stringify({ senderEmail, host, port: Number(port), security, username, password }),
      });
      setSettings(value);
      setPassword("");
      setNotice("SMTP connection verified and saved. Email is ready to send.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify SMTP settings");
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/gmail/smtp-settings", { method: "DELETE" });
      setSettings((current) => current ? { ...current, configured: false, passwordConfigured: false } : current);
      setPassword("");
      setNotice("SMTP account disconnected.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to disconnect SMTP account");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!settings) {
    return <section className="mx-auto max-w-3xl space-y-4">
      <Link href="/gmail" className="text-sm font-semibold text-primary hover:underline">← Email conversations</Link>
      <h1 className="text-2xl font-bold tracking-tight">Email settings</h1>
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error || "Unable to load email settings."}</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>Try again</Button>
    </section>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/gmail" className="text-sm font-semibold text-primary hover:underline">← Email conversations</Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Email settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add your sender and SMTP details. We’ll test the connection before saving.</p>
      </div>
      <Card>
        <CardHeader>
          <span className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600"><Mail className="h-5 w-5" /></span>
          <CardTitle>SMTP sender</CardTitle>
          <CardDescription>For Gmail, enable 2-Step Verification and use a Google App Password with smtp.gmail.com. Use the Gmail address that owns the app password as the SMTP username. The sender must be that address or a verified “Send mail as” alias.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {settings.configured ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><div><p className="font-semibold text-emerald-950">SMTP connected</p><p className="text-sm text-emerald-800">Sending as {settings.senderEmail}</p></div></div>
            {settings.canEdit ? <Button disabled={working} onClick={() => void disconnect()} type="button" variant="outline">{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}Disconnect</Button> : null}
          </div> : null}
          <form className="grid gap-4" onChange={() => { setError(""); setNotice(""); }} onSubmit={save}>
            <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="smtp-sender">Sender email</label><Input autoComplete="email" id="smtp-sender" onChange={(event) => setSenderEmail(event.target.value)} placeholder="you@example.com" required type="email" value={senderEmail} /></div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="smtp-host">SMTP host</label><Input autoComplete="off" id="smtp-host" onChange={(event) => setHost(event.target.value)} placeholder="smtp.gmail.com" required value={host} /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="smtp-port">Port</label><Input id="smtp-port" max="65535" min="1" onChange={(event) => setPort(event.target.value)} required type="number" value={port} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="smtp-security">Connection security</label><select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" id="smtp-security" onChange={(event) => setSecurity(event.target.value as "SSL_TLS" | "STARTTLS")} value={security}><option value="STARTTLS">STARTTLS (usually port 587)</option><option value="SSL_TLS">SSL/TLS (usually port 465)</option></select></div>
              <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="smtp-username">SMTP username</label><Input autoComplete="username" id="smtp-username" onChange={(event) => setUsername(event.target.value)} placeholder="Usually your email address" required value={username} /></div>
            </div>
            {host.trim().toLowerCase() === "smtp.gmail.com" && senderEmail.trim() && username.trim() && senderEmail.trim().toLowerCase() !== username.trim().toLowerCase() ? <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">Your Gmail sender and sign-in addresses differ. Gmail will send from a different address only if it is configured as a verified “Send mail as” alias.</p> : null}
            <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="smtp-password">SMTP password or app password</label><Input autoComplete="new-password" id="smtp-password" onChange={(event) => setPassword(event.target.value)} placeholder={settings.passwordConfigured ? "Saved securely; leave blank to keep it" : "Enter SMTP password"} required={!settings.passwordConfigured || host !== settings.host || username !== settings.username} type="password" value={password} /><p className="text-xs text-muted-foreground">The password is encrypted in the backend and never shown again.</p></div>
            <div className="flex flex-wrap items-center gap-3"><Button disabled={working || !settings.canEdit} type="submit">{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save and test SMTP</Button>{!settings.canEdit ? <p className="text-sm text-muted-foreground">Only the workspace owner can change email settings.</p> : null}</div>
          </form>
          {notice ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p> : null}
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
