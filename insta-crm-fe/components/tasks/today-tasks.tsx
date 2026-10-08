"use client";

import type { TaskSummary } from "@insta-crm/shared-types";
import { CalendarCheck2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function TodayTasks() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<TaskSummary[]>("/tasks/today")
      .then(setTasks)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load tasks",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const overdue = useMemo(
    () => tasks.filter((task) => task.status === "overdue"),
    [tasks],
  );
  const today = useMemo(
    () => tasks.filter((task) => task.status !== "overdue"),
    [tasks],
  );

  async function complete(task: TaskSummary) {
    setCompletingId(task.id);
    setError("");
    try {
      await apiFetch<TaskSummary>("/tasks/" + task.id + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to complete task",
      );
    } finally {
      setCompletingId(null);
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
    <section className="mx-auto max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One place for every follow-up due today or already overdue.
        </p>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!tasks.length ? (
        <div className="mt-5 rounded-lg border border-dashed bg-white px-6 py-12 text-center">
          <CalendarCheck2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h2 className="mt-3 text-lg font-semibold">You are all caught up</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            New contacts automatically receive a follow-up. You can also add
            tasks from any contact or deal.
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link href="/contacts">View contacts</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-7">
          {overdue.length ? (
            <TaskGroup
              completingId={completingId}
              heading="Overdue"
              onComplete={complete}
              tasks={overdue}
            />
          ) : null}
          {today.length ? (
            <TaskGroup
              completingId={completingId}
              heading="Due today"
              onComplete={complete}
              tasks={today}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function TaskGroup({
  completingId,
  heading,
  onComplete,
  tasks,
}: {
  completingId: string | null;
  heading: string;
  onComplete: (task: TaskSummary) => void;
  tasks: TaskSummary[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{heading}</h2>
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            completing={completingId === task.id}
            key={task.id}
            onComplete={onComplete}
            task={task}
          />
        ))}
      </div>
    </section>
  );
}
