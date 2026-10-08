"use client";

import type { ConversationSummary } from "@insta-crm/shared-types";
import { Loader2, MessageCircle, MoveRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function ContactConversations({ contactId }: { contactId: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ConversationSummary[]>(
      "/conversations?contactId=" + encodeURIComponent(contactId) + "&channel=email",
    )
      .then(setConversations)
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load conversations",
        ),
      )
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (!conversations.length) {
    return (
      <div className="py-4 text-center">
        <MessageCircle className="mx-auto h-7 w-7 text-slate-400" />
        <h2 className="mt-3 font-semibold">No conversation yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open email to write to this contact or review their email thread.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={"/gmail?contactId=" + contactId}>Open email</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {conversations.map((conversation) => (
        <div
          className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4"
          key={conversation.id}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold capitalize">
                {conversation.channel} conversation
              </h2>
              {conversation.unreadCount ? (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                  {conversation.unreadCount} unread
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {conversation.lastMessage?.body ?? "No messages yet"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {conversation.assignedTo
                ? "Assigned to " + conversation.assignedTo.name
                : "Unassigned"}
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href={"/gmail?conversationId=" + conversation.id}>
              Open conversation <MoveRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
