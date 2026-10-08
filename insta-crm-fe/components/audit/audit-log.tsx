"use client";

import type { AuditLogResponse } from "@insta-crm/shared-types";
import { Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export function AuditLog() {
  const t = useTranslations("Audit");
  const [result, setResult] = useState<AuditLogResponse | null>(null);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams({ limit: "100" });
      if (entityType.trim()) parameters.set("entityType", entityType.trim());
      if (action.trim()) parameters.set("action", action.trim());
      apiFetch<AuditLogResponse>(`/audit-logs?${parameters}`)
        .then(setResult)
        .catch((caught) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load audit log",
          ),
        );
    }, 200);
    return () => window.clearTimeout(timer);
  }, [action, entityType]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                onChange={(event) => setEntityType(event.target.value)}
                placeholder="Entity type (contact, invoice…)"
                value={entityType}
              />
            </label>
            <Input
              onChange={(event) => setAction(event.target.value)}
              placeholder="Action (created, updated…)"
              value={action}
            />
          </div>
        </CardContent>
      </Card>
      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      {!result ? (
        <div className="grid min-h-48 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : result.items.length ? (
        <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="hidden grid-cols-[1fr_1fr_1fr_11rem] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 sm:grid">
            <span>{t("actor")}</span>
            <span>{t("action")}</span>
            <span>{t("entity")}</span>
            <span>{t("time")}</span>
          </div>
          {result.items.map((item) => (
            <article
              className="grid gap-1 border-b px-4 py-3 last:border-0 sm:grid-cols-[1fr_1fr_1fr_11rem] sm:gap-3"
              key={item.id}
            >
              <p className="font-medium">
                {item.actor.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.actor.role}
                </span>
              </p>
              <p className="text-sm capitalize">
                {item.action.replaceAll("_", " ")}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {item.entityType} · {item.entityId}
                {Array.isArray(item.metadata.fields) &&
                item.metadata.fields.length
                  ? ` · ${(item.metadata.fields as string[]).join(", ")}`
                  : ""}
              </p>
              <time className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.createdAt))}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </section>
  );
}
