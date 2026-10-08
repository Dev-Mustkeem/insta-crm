"use client";

import type {
  ConversationSuggestionsResponse,
  ConversationOptionsResponse,
  ConversationThreadResponse,
  WhatsAppTemplateSummary,
} from "@insta-crm/shared-types";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { TemplatePanel } from "@/components/inbox/template-panel";
import { MessageBubble, NoteBubble } from "@/components/inbox/thread-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export function ThreadView({
  loading,
  onBack,
  onChanged,
  options,
  senderEmail,
  smtpConnected,
  thread,
}: {
  loading: boolean;
  onBack: () => void;
  onChanged: () => void;
  options: ConversationOptionsResponse | null;
  senderEmail?: string | null;
  smtpConnected?: boolean;
  thread: ConversationThreadResponse | null;
}) {
  const t = useTranslations("Inbox");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<WhatsAppTemplateSummary | null>(null);
  const [parameters, setParameters] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setEmailTo("");
    setEmailCc("");
    setEmailBcc("");
    setSubject("");
  }, [thread?.conversation.id]);

  const events = useMemo(() => {
    if (!thread) return [];
    return [
      ...thread.messages.map((message) => ({
        kind: "message" as const,
        createdAt: message.createdAt,
        value: message,
      })),
      ...thread.notes.map((item) => ({
        kind: "note" as const,
        createdAt: item.createdAt,
        value: item,
      })),
    ].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime(),
    );
  }, [thread]);

  async function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      await apiFetch("/conversations/" + thread.conversation.id + "/messages", {
        method: "POST",
        body: JSON.stringify({
          body,
          ...(thread.conversation.channel === "email" ? {
            subject,
            to: emailTo || thread.conversation.contact.email || "",
            cc: emailCc,
            bcc: emailBcc,
          } : {}),
        }),
      });
      setBody("");
      setSubject("");
      setEmailTo("");
      setEmailCc("");
      setEmailBcc("");
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send message",
      );
    } finally {
      setSending(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread || !note.trim()) return;
    setSending(true);
    setError("");
    try {
      await apiFetch("/conversations/" + thread.conversation.id + "/notes", {
        method: "POST",
        body: JSON.stringify({ body: note }),
      });
      setNote("");
      setNoteOpen(false);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add note");
    } finally {
      setSending(false);
    }
  }

  async function changeAssignment(assignedToId: string) {
    if (!thread) return;
    setError("");
    try {
      await apiFetch(
        "/conversations/" + thread.conversation.id + "/assignment",
        {
          method: "PATCH",
          body: JSON.stringify({ assignedToId: assignedToId || null }),
        },
      );
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to assign conversation",
      );
    }
  }

  async function openTemplates() {
    setTemplateOpen(true);
    if (templates.length) return;
    setError("");
    try {
      setTemplates(
        await apiFetch<WhatsAppTemplateSummary[]>("/whatsapp/templates"),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load templates",
      );
    }
  }

  async function loadSuggestions() {
    if (!thread) return;
    try {
      const result = await apiFetch<ConversationSuggestionsResponse>(
        "/conversations/" + thread.conversation.id + "/suggestions",
      );
      setSuggestions(result.suggestions);
    } catch {
      setSuggestions([]);
    }
  }

  function chooseTemplate(template: WhatsAppTemplateSummary) {
    setSelectedTemplate(template);
    setParameters(Array.from({ length: template.parameterCount }, () => ""));
  }

  async function sendTemplate() {
    if (!thread || !selectedTemplate) return;
    setSending(true);
    setError("");
    try {
      await apiFetch(
        "/conversations/" + thread.conversation.id + "/templates",
        {
          method: "POST",
          body: JSON.stringify({
            name: selectedTemplate.name,
            language: selectedTemplate.language,
            parameters,
          }),
        },
      );
      setTemplateOpen(false);
      setSelectedTemplate(null);
      setParameters([]);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send template",
      );
    } finally {
      setSending(false);
    }
  }

  if (loading && !thread) {
    return (
      <div className="grid min-h-[36rem] place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!thread) return null;

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col lg:h-full lg:min-h-0">
      <header className="flex items-center gap-3 border-b px-3 py-2.5 sm:px-4">
        <Button
          aria-label="Back to conversations"
          className="lg:hidden"
          onClick={onBack}
          size="icon"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800">
          {thread.conversation.contact.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            className="block truncate font-semibold hover:text-primary hover:underline"
            href={"/contacts/" + thread.conversation.contact.id}
          >
            {thread.conversation.contact.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {thread.conversation.channel === "email" ? "GMAIL" : thread.conversation.channel.toUpperCase()} ·{" "}
            {thread.conversation.channel === "email"
              ? thread.conversation.contact.email ?? thread.conversation.contact.phone
              : thread.conversation.contact.phone}
          </p>
        </div>
        {options?.canAssign ? (
          <select
            aria-label="Assign conversation"
            className="h-10 max-w-32 rounded-md border bg-white px-2 text-sm outline-none focus:border-primary sm:max-w-44"
            onChange={(event) => void changeAssignment(event.target.value)}
            value={thread.conversation.assignedTo?.id ?? ""}
          >
            <option value="">Unassigned</option>
            {options?.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {thread.conversation.assignedTo?.name ?? "Unassigned"}
          </span>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] p-3 sm:p-5">
        {events.map((event) =>
          event.kind === "message" ? (
            <MessageBubble key={event.value.id} message={event.value} />
          ) : (
            <NoteBubble key={event.value.id} note={event.value} />
          ),
        )}
        {!events.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("noMessages")}
          </p>
        ) : null}
      </div>

      <div className="border-t bg-white p-3">
        {error ? (
          <p
            className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {templateOpen ? (
          <TemplatePanel
            onChangeParameter={(index, value) =>
              setParameters((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? value : item,
                ),
              )
            }
            onChoose={chooseTemplate}
            onClose={() => {
              setTemplateOpen(false);
              setSelectedTemplate(null);
            }}
            onSend={() => void sendTemplate()}
            parameters={parameters}
            selected={selectedTemplate}
            sending={sending}
            templates={templates}
          />
        ) : noteOpen ? (
          <form className="flex items-end gap-2" onSubmit={addNote}>
            <textarea
              autoFocus
              className="min-h-11 flex-1 resize-none rounded-md border bg-amber-50 px-3 py-2 text-base outline-none focus:border-amber-500"
              maxLength={4000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Internal note — not visible to customer"
              required
              rows={2}
              value={note}
            />
            <Button disabled={sending} size="icon" type="submit">
              <StickyNote className="h-4 w-4" />
            </Button>
            <Button
              aria-label="Cancel note"
              onClick={() => setNoteOpen(false)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="space-y-2">
            {thread.conversation.channel === "whatsapp" ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Button onClick={() => void loadSuggestions()} size="sm" type="button" variant="outline">
                  Suggest replies
                </Button>
                {suggestions.map((suggestion) => (
                  <button className="shrink-0 rounded-full border bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900 hover:bg-emerald-100" key={suggestion} onClick={() => setBody(suggestion)} type="button">
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            {thread.conversation.channel === "email" ? (
              <div className="grid gap-2">
                {smtpConnected && senderEmail ? (
                  <p className="px-1 text-xs text-muted-foreground">From: {senderEmail}</p>
                ) : (
                  <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    Add and test your SMTP account to send messages. <Link className="font-semibold underline" href="/gmail/settings">Set up email</Link>
                  </p>
                )}
                <Input aria-label="To" onChange={(event) => setEmailTo(event.target.value)} placeholder="To (comma-separated for bulk mailing)" value={emailTo} />
                <Input aria-label="Cc" onChange={(event) => setEmailCc(event.target.value)} placeholder="Cc (optional; comma-separated)" value={emailCc} />
                <Input aria-label="Bcc" onChange={(event) => setEmailBcc(event.target.value)} placeholder="Bcc (optional; comma-separated)" value={emailBcc} />
                <Input onChange={(event) => setSubject(event.target.value)} placeholder={t("subject")} required value={subject} />
              </div>
            ) : null}
            <form className="flex items-end gap-2" onSubmit={sendText}>
              <Button
                aria-label="Add internal note"
                onClick={() => setNoteOpen(true)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <StickyNote className="h-5 w-5" />
              </Button>
              {thread.conversation.channel === "whatsapp" ? (
                <Button
                  aria-label="Choose template"
                  onClick={() => void openTemplates()}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <FileText className="h-5 w-5" />
                </Button>
              ) : null}
              <textarea
                className="min-h-11 flex-1 resize-none rounded-md border px-3 py-2 text-base outline-none focus:border-primary"
                maxLength={4096}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t("typeMessage")}
                required
                rows={2}
                value={body}
              />
              <Button
                aria-label="Send message"
                disabled={sending || !body.trim() || (thread.conversation.channel === "email" && !smtpConnected)}
                size="icon"
                type="submit"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
