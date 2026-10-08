"use client";

import type {
  TaskInput,
  TaskOptionsResponse,
  TaskRelatedEntityType,
  TaskSummary,
} from "@insta-crm/shared-types";
import { CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export function EntityTasks({
  entityId,
  entityType,
}: {
  entityId: string;
  entityType: Extract<TaskRelatedEntityType, "contact" | "deal" | "invoice">;
}) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [options, setOptions] = useState<TaskOptionsResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueInput);
  const [assignedToId, setAssignedToId] = useState("");
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams({
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      limit: "100",
    });
    Promise.all([
      apiFetch<TaskSummary[]>("/tasks?" + parameters.toString()),
      apiFetch<TaskOptionsResponse>("/tasks/options"),
    ])
      .then(([taskResult, taskOptions]) => {
        setTasks(taskResult);
        setOptions(taskOptions);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load tasks",
        ),
      )
      .finally(() => setLoading(false));
  }, [entityId, entityType]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload: TaskInput = {
      title,
      dueAt: new Date(dueAt).toISOString(),
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      ...(assignedToId ? { assignedToId } : {}),
    };
    try {
      const created = await apiFetch<TaskSummary>("/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTasks((current) =>
        [...current, created].sort(
          (left, right) =>
            new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
        ),
      );
      setTitle("");
      setDueAt(defaultDueInput());
      setAssignedToId("");
      setFormOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create task",
      );
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Tasks & follow-ups</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {tasks.length} open {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <Button
          aria-label={formOpen ? "Close task form" : "Add task"}
          onClick={() => setFormOpen((current) => !current)}
          size="icon"
          variant={formOpen ? "ghost" : "default"}
        >
          {formOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </Button>
      </CardHeader>
      <CardContent>
        {formOpen ? (
          <form
            className="mb-5 space-y-4 rounded-lg border bg-slate-50 p-4"
            onSubmit={createTask}
          >
            <div className="space-y-2">
              <Label htmlFor={"task-title-" + entityId}>Task</Label>
              <Input
                autoFocus
                id={"task-title-" + entityId}
                maxLength={160}
                minLength={2}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Call and confirm next steps"
                required
                value={title}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={"task-due-" + entityId}>Due</Label>
                <Input
                  id={"task-due-" + entityId}
                  onChange={(event) => setDueAt(event.target.value)}
                  required
                  type="datetime-local"
                  value={dueAt}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={"task-assignee-" + entityId}>Assigned to</Label>
                <select
                  className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  id={"task-assignee-" + entityId}
                  onChange={(event) => setAssignedToId(event.target.value)}
                  value={assignedToId}
                >
                  <option value="">Assign to me</option>
                  {options?.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button disabled={saving || !options} type="submit">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-2 h-4 w-4" />
              )}
              Save follow-up
            </Button>
          </form>
        ) : null}

        {error ? (
          <p
            className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="grid min-h-24 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tasks.length ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                completing={completingId === task.id}
                key={task.id}
                onComplete={complete}
                task={task}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-5 py-8 text-center">
            <CalendarPlus className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 font-semibold">No open follow-ups</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a task so the next step is never missed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function defaultDueInput(): string {
  const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
  value.setMinutes(0, 0, 0);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
