"use client";

import type {
  ConversationChannel,
  ConversationOptionsResponse,
  ConversationSummary,
  ConversationThreadResponse,
} from "@insta-crm/shared-types";
import { Loader2, MessageCircle, Plus, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ThreadView } from "@/components/inbox/thread-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Inbox({ channelFilter }: { channelFilter?: "email" } = {}) {
  const t = useTranslations("Inbox");
  const searchParameters = useSearchParams();
  const requestedConversationId = searchParameters.get("conversationId");
  const requestedContactId = searchParameters.get("contactId");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    requestedConversationId,
  );
  const [thread, setThread] = useState<ConversationThreadResponse | null>(null);
  const [options, setOptions] = useState<ConversationOptionsResponse | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [contactId, setContactId] = useState(requestedContactId ?? "");
  const [channel, setChannel] = useState<Exclude<ConversationChannel, "call">>(
    channelFilter ?? "whatsapp",
  );
  const [smtpConnected, setSmtpConnected] = useState(false);
  const [emailSender, setEmailSender] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState("");

  async function createConversation() {
    if (!contactId) return;
    setError("");
    try {
      const created = await apiFetch<ConversationThreadResponse>(
        "/conversations",
        {
          method: "POST",
          body: JSON.stringify({ contactId, channel }),
        },
      );
      setSelectedId(created.conversation.id);
      setThread(created);
      setCreateOpen(false);
      void loadConversations();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start conversation",
      );
    }
  }

  const loadConversations = useCallback(async () => {
    const parameters = new URLSearchParams({ limit: "200" });
    if (channelFilter) parameters.set("channel", channelFilter);
    if (search.trim()) parameters.set("search", search.trim());
    if (requestedContactId) parameters.set("contactId", requestedContactId);
    try {
      const result = await apiFetch<ConversationSummary[]>(
        "/conversations?" + parameters.toString(),
      );
      const visible = channelFilter
        ? result.filter((item) => item.channel === channelFilter)
        : result;
      setConversations(visible);
      if (!selectedId && (requestedContactId || requestedConversationId)) {
        setSelectedId(requestedConversationId || visible[0]?.id || null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load inbox",
      );
    } finally {
      setLoadingList(false);
    }
  }, [channelFilter, requestedContactId, requestedConversationId, search, selectedId]);

  const loadThread = useCallback(async (conversationId: string) => {
    try {
      const result = await apiFetch<ConversationThreadResponse>(
        "/conversations/" + conversationId,
      );
      setThread(result);
      await apiFetch("/conversations/" + conversationId + "/read", {
        method: "POST",
        body: "{}",
      });
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load conversation",
      );
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversations(), 250);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    apiFetch<ConversationOptionsResponse>("/conversations/options")
      .then(setOptions)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!channelFilter) return;
    apiFetch<{ configured: boolean; senderEmail: string }>("/gmail/smtp-settings")
      .then((result) => {
        setSmtpConnected(result.configured);
        setEmailSender(result.senderEmail || null);
        if (!result.configured) setEmailNotice("Connect an SMTP sender in Email settings to send messages.");
      })
      .catch((caught) => setEmailNotice(caught instanceof Error ? caught.message : "Unable to check SMTP connection"));
  }, [channelFilter]);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    setLoadingThread(true);
    void loadThread(selectedId);
    const interval = window.setInterval(
      () => void loadThread(selectedId),
      5_000,
    );
    return () => window.clearInterval(interval);
  }, [loadThread, selectedId]);

  useEffect(() => {
    const interval = window.setInterval(() => void loadConversations(), 10_000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{channelFilter ? "Email conversations" : t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{channelFilter ? "Send and track customer email using your SMTP account." : t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {channelFilter ? (
            <Button asChild variant="outline">
              <Link href="/gmail/settings">{smtpConnected ? "Email settings" : "Set up SMTP"}</Link>
            </Button>
          ) : null}
          <Button onClick={() => setCreateOpen((value) => !value)} variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />{channelFilter ? "New email" : t("newConversation")}
          </Button>
          {options?.canAssign && !channelFilter ? (
            <Button asChild size="icon" variant="outline">
              <Link aria-label="Channel settings" href="/inbox/channels">
                <Settings2 className="h-5 w-5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {channelFilter && emailNotice ? <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">{emailNotice}</p> : null}

      {error ? (
        <p
          className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white shadow-soft lg:grid lg:h-[calc(100dvh-10.5rem)] lg:min-h-[36rem] lg:grid-cols-[20rem_1fr]">
        <aside
          className={cn("border-r", selectedId ? "hidden lg:block" : "block")}
        >
          <div className="border-b p-3">
            {createOpen ? (
              <div className="mb-3 space-y-2 rounded-md border bg-slate-50 p-3">
                <select
                  className="h-11 w-full rounded-md border bg-white px-3 text-sm"
                  onChange={(event) => setContactId(event.target.value)}
                  value={contactId}
                >
                  <option value="">{channelFilter ? "Choose email contact" : "Choose contact"}</option>
                  {options?.contacts.filter((contact) => !channelFilter || Boolean(contact.email)).map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} · {contact.phone}
                    </option>
                  ))}
                </select>
                {!channelFilter ? (
                  <select
                    className="h-11 w-full rounded-md border bg-white px-3 text-sm"
                    onChange={(event) => setChannel(event.target.value as typeof channel)}
                    value={channel}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                ) : null}
                <Button
                  className="w-full"
                  disabled={!contactId}
                  onClick={() => void createConversation()}
                  size="sm"
                >
                  {channelFilter ? "Start email" : "Start conversation"}
                </Button>
              </div>
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                aria-label="Search conversations"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("search")}
                value={search}
              />
            </div>
          </div>
          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto lg:h-[calc(100%-4.25rem)] lg:max-h-none">
            {loadingList ? (
              <div className="grid min-h-48 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversations.length ? (
              conversations.map((conversation) => (
                <ConversationRow
                  active={conversation.id === selectedId}
                  conversation={conversation}
                  key={conversation.id}
                  onClick={() => {
                    setThread(null);
                    setSelectedId(conversation.id);
                    setError("");
                  }}
                />
              ))
            ) : (
              <div className="px-5 py-12 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-slate-400" />
                <h2 className="mt-3 font-semibold">{t("noConversations")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("noConversationsHelp")}
                </p>
              </div>
            )}
          </div>
        </aside>

        <main className={cn(selectedId ? "block" : "hidden lg:block")}>
          {selectedId ? (
            <ThreadView
              loading={loadingThread}
              onBack={() => setSelectedId(null)}
              onChanged={() => {
                void loadThread(selectedId);
                void loadConversations();
              }}
                options={options}
                senderEmail={emailSender}
                smtpConnected={smtpConnected}
                thread={thread}
            />
          ) : (
            <div className="grid h-full min-h-[36rem] place-items-center p-8 text-center">
              <div>
                <MessageCircle className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-4 text-lg font-semibold">{t("choose")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("chooseHelp")}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function ConversationRow({
  active,
  conversation,
  onClick,
}: {
  active: boolean;
  conversation: ConversationSummary;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex min-h-20 w-full items-center gap-3 border-b px-3 py-3 text-left hover:bg-slate-50",
        active && "bg-emerald-50",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
        {conversation.contact.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">
            {conversation.contact.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {conversation.lastMessageAt
              ? shortTime(conversation.lastMessageAt)
              : ""}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
            {conversation.channel}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {conversation.lastMessage?.body ?? "No messages"}
          </span>
          {conversation.unreadCount ? (
            <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
