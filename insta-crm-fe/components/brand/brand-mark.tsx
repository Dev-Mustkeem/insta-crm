import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

/**
 * Renders the temporary Insta ICT Solutions wordmark until the official logo is supplied.
 *
 * @param props - Display options for the brand mark.
 * @returns A theme-aligned text and icon wordmark.
 */
export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-insta-sm">
        <Building2 aria-hidden="true" className="h-5 w-5" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-sm font-extrabold tracking-tight text-[#003a62]">
            Insta ICT Solutions
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A651]">
            CRM
          </span>
        </span>
      ) : null}
    </span>
  );
}
