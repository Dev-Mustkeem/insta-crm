import type { WhatsAppTemplateSummary } from "@insta-crm/shared-types";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TemplatePanel({
  onChangeParameter,
  onChoose,
  onClose,
  onSend,
  parameters,
  selected,
  sending,
  templates,
}: {
  onChangeParameter: (index: number, value: string) => void;
  onChoose: (template: WhatsAppTemplateSummary) => void;
  onClose: () => void;
  onSend: () => void;
  parameters: string[];
  selected: WhatsAppTemplateSummary | null;
  sending: boolean;
  templates: WhatsAppTemplateSummary[];
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Approved template</p>
        <Button
          aria-label="Close templates"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <select
        className="mt-2 h-11 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-primary"
        onChange={(event) => {
          const template = templates.find(
            (item) => item.id === event.target.value,
          );
          if (template) onChoose(template);
        }}
        value={selected?.id ?? ""}
      >
        <option value="">
          {templates.length
            ? "Choose a template"
            : "No approved templates found"}
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} · {template.language}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="mt-3">
          <p className="rounded bg-white p-3 text-sm text-muted-foreground">
            {selected.body || selected.name}
          </p>
          {parameters.map((parameter, index) => (
            <Input
              className="mt-2"
              key={index}
              onChange={(event) => onChangeParameter(index, event.target.value)}
              placeholder={"Value for {{" + (index + 1) + "}}"}
              value={parameter}
            />
          ))}
          <Button
            className="mt-3 w-full"
            disabled={sending || parameters.some((value) => !value.trim())}
            onClick={onSend}
            type="button"
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send template
          </Button>
        </div>
      ) : null}
    </div>
  );
}
