import type {
  ConversationMessage,
  ConversationNote,
} from "@insta-crm/shared-types";
import { Check, CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ConversationMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[86%] rounded-lg px-3 py-2 shadow-sm sm:max-w-[70%]",
          outbound ? "bg-[#d9fdd3]" : "bg-white",
        )}
      >
        {message.subject ? (
          <p className="mb-1 border-b pb-1 text-xs font-semibold">
            {message.subject}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.body}
        </p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
          <span>{messageTime(message.createdAt)}</span>
          {outbound ? <MessageStatusIcon status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
}

export function NoteBubble({ note }: { note: ConversationNote }) {
  return (
    <div className="mx-auto max-w-[90%] rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:max-w-[70%]">
      <p className="whitespace-pre-wrap break-words">{note.body}</p>
      <p className="mt-1 text-[10px] text-amber-700">
        Internal · {note.author.name} · {messageTime(note.createdAt)}
      </p>
    </div>
  );
}

function MessageStatusIcon({
  status,
}: {
  status: ConversationMessage["status"];
}) {
  if (status === "failed") return <X className="h-3 w-3 text-red-600" />;
  if (status === "sent") return <Check className="h-3 w-3" />;
  return (
    <CheckCheck
      className={cn("h-3 w-3", status === "read" && "text-sky-600")}
    />
  );
}

function messageTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
