"use client";

import type { TaskSummary } from "@insta-crm/shared-types";
import { Check, Clock3, ExternalLink, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TaskCard({
  completing,
  onComplete,
  task,
}: {
  completing: boolean;
  onComplete: (task: TaskSummary) => void;
  task: TaskSummary;
}) {
  const overdue = task.status === "overdue";
  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-4 shadow-sm",
        overdue && "border-red-200 bg-red-50/40",
      )}
    >
      <div className="flex items-start gap-3">
        <Button
          aria-label={"Mark " + task.title + " done"}
          className="mt-0.5 shrink-0 rounded-full"
          disabled={completing}
          onClick={() => onComplete(task)}
          size="icon"
          title="Mark done"
          variant="outline"
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-5 w-5" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="break-words font-semibold">{task.title}</h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                overdue
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-800",
              )}
            >
              {overdue ? "Overdue" : pendingLabel(task.dueAt)}
            </span>
          </div>
          <p
            className={cn(
              "mt-2 flex items-center gap-2 text-sm",
              overdue ? "text-red-700" : "text-muted-foreground",
            )}
          >
            <Clock3 className="h-4 w-4 shrink-0" /> {formatTaskDue(task.dueAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4" /> {task.assignedTo.name}
            </span>
            {task.relatedEntity.href ? (
              <Link
                className="inline-flex min-h-9 items-center gap-1.5 font-medium text-primary hover:underline"
                href={task.relatedEntity.href}
              >
                {task.relatedEntity.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span>{task.relatedEntity.label}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function formatTaskDue(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function pendingLabel(value: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  return formatter.format(new Date(value)) === formatter.format(new Date())
    ? "Due today"
    : "Upcoming";
}
