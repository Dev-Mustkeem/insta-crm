"use client";

import {
  type ContactDuplicateWarning,
  type ContactInput,
  type ContactMutationResponse,
  type ContactSource,
  type ContactSummary,
} from "@insta-crm/shared-types";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { CONTACT_SOURCE_OPTIONS, contactSourceLabels } from "@/lib/contacts";

interface CustomFieldRow {
  id: number;
  key: string;
  value: string;
}

export function ContactForm({
  contact,
  mode,
}: {
  contact?: ContactSummary;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [source, setSource] = useState<ContactSource>(
    contact?.source ?? "other",
  );
  const [tags, setTags] = useState(contact?.tags.join(", ") ?? "");
  const [assignedToId, setAssignedToId] = useState(
    contact?.assignedTo.id ?? "",
  );
  const [creditTermsDays, setCreditTermsDays] = useState(
    contact?.creditTermsDays ?? 30,
  );
  const [gstin, setGstin] = useState(contact?.gstin ?? "");
  const [billingStateCode, setBillingStateCode] = useState(
    contact?.billingStateCode ?? "",
  );
  const [team, setTeam] = useState<
    Array<{ id: string; name: string; role: string }>
  >([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>(() =>
    Object.entries(contact?.customFields ?? {}).map(([key, value], index) => ({
      id: index + 1,
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    })),
  );
  const [nextFieldId, setNextFieldId] = useState(
    Object.keys(contact?.customFields ?? {}).length + 1,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState<ContactDuplicateWarning | null>(null);
  const [savedContactId, setSavedContactId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Array<{ id: string; name: string; role: string }>>(
      "/contacts/options",
    )
      .then((users) => {
        setTeam(users);
        if (!assignedToId && users.length === 1) setAssignedToId(users[0]!.id);
      })
      .catch(() => undefined);
  }, [assignedToId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setWarning(null);

    const fields = Object.fromEntries(
      customFields
        .filter((field) => field.key.trim())
        .map((field) => [field.key.trim(), field.value.trim()]),
    );
    const payload: ContactInput = {
      name,
      phone,
      ...(email.trim()
        ? { email: email.trim() }
        : mode === "edit"
          ? { email: null }
          : {}),
      source,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      customFields: fields,
      ...(assignedToId ? { assignedToId } : {}),
      creditTermsDays,
      ...(gstin.trim()
        ? { gstin: gstin.trim() }
        : mode === "edit"
          ? { gstin: null }
          : {}),
      ...(billingStateCode.trim()
        ? { billingStateCode: billingStateCode.trim() }
        : mode === "edit"
          ? { billingStateCode: null }
          : {}),
    };

    try {
      const response = await apiFetch<ContactMutationResponse>(
        mode === "create" ? "/contacts" : "/contacts/" + contact?.id,
        {
          method: mode === "create" ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      const duplicate = response.warnings[0];
      if (duplicate) {
        setWarning(duplicate);
        setSavedContactId(response.contact.id);
      } else {
        router.replace("/contacts/" + response.contact.id);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save contact",
      );
    } finally {
      setLoading(false);
    }
  }

  function addCustomField() {
    setCustomFields((current) => [
      ...current,
      { id: nextFieldId, key: "", value: "" },
    ]);
    setNextFieldId((current) => current + 1);
  }

  function updateCustomField(id: number, key: "key" | "value", value: string) {
    setCustomFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, [key]: value } : field,
      ),
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Add contact" : "Edit contact"}
        </CardTitle>
        <CardDescription>
          Keep the essentials handy. You can add more context with tags and
          custom fields.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {warning && savedContactId ? (
          <div
            className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4"
            role="alert"
          >
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">
                  Contact saved with a possible duplicate
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  {warning.contact
                    ? `${warning.contact.name} already uses ${warning.contact.phone}.`
                    : "This phone number is already assigned to another team member."}{" "}
                  The save was not blocked.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={"/contacts/" + savedContactId}>
                      Open saved contact
                    </Link>
                  </Button>
                  {warning.contact ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={"/contacts/" + warning.contact.id}>
                        Review possible duplicate
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="name" label="Name">
              <Input
                id="name"
                autoComplete="name"
                autoFocus
                maxLength={100}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                placeholder="Priya Mehta"
                required
                value={name}
              />
            </Field>
            <Field id="phone" label="Phone">
              <Input
                id="phone"
                autoComplete="tel"
                inputMode="tel"
                maxLength={20}
                minLength={7}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                required
                value={phone}
              />
            </Field>
            <Field id="email" label={source === "gmail" ? "Email address" : "Email (optional)"}>
              <Input
                id="email"
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="priya@example.com"
                required={source === "gmail"}
                type="email"
                value={email}
              />
            </Field>
            <Field id="source" label="Source">
              <select
                className="h-12 w-full rounded-md border bg-white px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                id="source"
                onChange={(event) =>
                  setSource(event.target.value as ContactSource)
                }
                value={source}
              >
                {contact && !CONTACT_SOURCE_OPTIONS.includes(contact.source as (typeof CONTACT_SOURCE_OPTIONS)[number]) ? (
                  <option value={contact.source} key={contact.source}>
                    {contactSourceLabels[contact.source]} (existing)
                  </option>
                ) : null}
                {CONTACT_SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {contactSourceLabels[option]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="assignedTo" label="Assigned to">
              <select
                className="h-12 w-full rounded-md border bg-white px-3"
                id="assignedTo"
                onChange={(event) => setAssignedToId(event.target.value)}
                required
                value={assignedToId}
              >
                <option value="">Choose team member</option>
                {team.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="creditTermsDays" label="Credit terms (days)">
              <Input
                id="creditTermsDays"
                max={365}
                min={0}
                onChange={(event) =>
                  setCreditTermsDays(Number(event.target.value))
                }
                required
                type="number"
                value={creditTermsDays}
              />
            </Field>
            <Field id="gstin" label="Customer GSTIN (optional)">
              <Input
                id="gstin"
                maxLength={15}
                onChange={(event) => setGstin(event.target.value.toUpperCase())}
                placeholder="27ABCDE1234F1Z5"
                value={gstin}
              />
            </Field>
            <Field id="billingStateCode" label="Place of supply code">
              <Input
                id="billingStateCode"
                inputMode="numeric"
                maxLength={2}
                onChange={(event) => setBillingStateCode(event.target.value)}
                placeholder="27"
                value={billingStateCode}
              />
            </Field>
          </div>

          <Field id="tags" label="Tags">
            <Input
              id="tags"
              maxLength={400}
              onChange={(event) => setTags(event.target.value)}
              placeholder="vip, retailer, pune"
              value={tags}
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas.
            </p>
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Custom fields</p>
                <p className="text-xs text-muted-foreground">
                  Optional business-specific details.
                </p>
              </div>
              <Button
                onClick={addCustomField}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add field
              </Button>
            </div>
            {customFields.map((field) => (
              <div
                className="grid grid-cols-[1fr_1fr_44px] gap-2"
                key={field.id}
              >
                <Input
                  aria-label="Custom field name"
                  maxLength={60}
                  onChange={(event) =>
                    updateCustomField(field.id, "key", event.target.value)
                  }
                  placeholder="Field name"
                  value={field.key}
                />
                <Input
                  aria-label="Custom field value"
                  maxLength={200}
                  onChange={(event) =>
                    updateCustomField(field.id, "value", event.target.value)
                  }
                  placeholder="Value"
                  value={field.value}
                />
                <Button
                  aria-label="Remove custom field"
                  onClick={() =>
                    setCustomFields((current) =>
                      current.filter((item) => item.id !== field.id),
                    )
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>

          {error ? (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="outline">
              <Link href={contact ? "/contacts/" + contact.id : "/contacts"}>
                Cancel
              </Link>
            </Button>
            <Button disabled={loading || Boolean(savedContactId)} type="submit">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {savedContactId
                ? "Saved"
                : mode === "create"
                  ? "Add contact"
                  : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
