"use client";

import type {
  PipelineStageCategory,
  PipelineStageInput,
  PipelineStageSummary,
} from "@insta-crm/shared-types";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

const categoryLabels: Record<PipelineStageCategory, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

export function StageManager() {
  const [stages, setStages] = useState<PipelineStageSummary[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [category, setCategory] = useState<PipelineStageCategory>("open");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<PipelineStageSummary[]>("/pipeline/stages")
      .then(setStages)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load stages",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function createStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const created = await apiFetch<PipelineStageSummary>("/pipeline/stages", {
        method: "POST",
        body: JSON.stringify({
          name,
          color,
          category,
        } satisfies PipelineStageInput),
      });
      setStages((current) => [...current, created]);
      setName("");
      setColor("#0f766e");
      setCategory("open");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create stage",
      );
    } finally {
      setCreating(false);
    }
  }

  function replaceStage(updated: PipelineStageSummary) {
    setStages((current) =>
      current.map((stage) => (stage.id === updated.id ? updated : stage)),
    );
  }

  function removeStage(stageId: string) {
    setStages((current) => current.filter((stage) => stage.id !== stageId));
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
      <Link
        className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
        href="/pipeline"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to pipeline
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline stages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Owners can tailor stage names, colours, and outcomes for this
          business.
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

      <div className="mt-5 space-y-3">
        {stages.map((stage) => (
          <StageRow
            key={stage.id}
            onError={setError}
            onRemove={removeStage}
            onUpdate={replaceStage}
            stage={stage}
          />
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-lg">Add a stage</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-[1fr_9rem_8rem_auto] sm:items-end"
            onSubmit={createStage}
          >
            <div className="space-y-2">
              <Label htmlFor="new-stage-name">Name</Label>
              <Input
                id="new-stage-name"
                maxLength={50}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                placeholder="Follow-up"
                required
                value={name}
              />
            </div>
            <CategorySelect
              id="new-stage-category"
              onChange={setCategory}
              value={category}
            />
            <ColorInput
              id="new-stage-color"
              onChange={setColor}
              value={color}
            />
            <Button disabled={creating} type="submit">
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

function StageRow({
  onError,
  onRemove,
  onUpdate,
  stage,
}: {
  onError: (message: string) => void;
  onRemove: (stageId: string) => void;
  onUpdate: (stage: PipelineStageSummary) => void;
  stage: PipelineStageSummary;
}) {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [category, setCategory] = useState(stage.category);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      const updated = await apiFetch<PipelineStageSummary>(
        "/pipeline/stages/" + stage.id,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            color,
            category,
          } satisfies PipelineStageInput),
        },
      );
      onUpdate(updated);
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "Unable to update stage",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete the " + stage.name + " stage?")) return;
    setDeleting(true);
    onError("");
    try {
      await apiFetch("/pipeline/stages/" + stage.id, { method: "DELETE" });
      onRemove(stage.id);
    } catch (caught) {
      onError(
        caught instanceof Error ? caught.message : "Unable to delete stage",
      );
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form
          className="grid gap-4 sm:grid-cols-[1fr_9rem_8rem_auto_auto] sm:items-end"
          onSubmit={save}
        >
          <div className="space-y-2">
            <Label htmlFor={"stage-name-" + stage.id}>Name</Label>
            <Input
              id={"stage-name-" + stage.id}
              maxLength={50}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </div>
          <CategorySelect
            id={"stage-category-" + stage.id}
            onChange={setCategory}
            value={category}
          />
          <ColorInput
            id={"stage-color-" + stage.id}
            onChange={setColor}
            value={color}
          />
          <Button
            disabled={saving || deleting}
            size="icon"
            title="Save stage"
            type="submit"
            variant="outline"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
          <Button
            aria-label={"Delete " + stage.name}
            disabled={saving || deleting}
            onClick={remove}
            size="icon"
            type="button"
            variant="ghost"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-red-600" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CategorySelect({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: PipelineStageCategory) => void;
  value: PipelineStageCategory;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Outcome</Label>
      <select
        className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        id={id}
        onChange={(event) =>
          onChange(event.target.value as PipelineStageCategory)
        }
        value={value}
      >
        {Object.entries(categoryLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorInput({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Colour</Label>
      <Input
        className="h-12 p-1"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={value}
      />
    </div>
  );
}
