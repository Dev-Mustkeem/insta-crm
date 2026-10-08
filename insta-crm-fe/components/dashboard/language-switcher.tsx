"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("Language");

  function change(value: string) {
    document.cookie = `CRM_LOCALE=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    // Full reload: Hindi text is applied in place, so a clean render is needed to switch back.
    window.location.reload();
  }

  return (
    <label className="relative flex items-center">
      <Languages className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-500" />
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        className="h-10 rounded-md border bg-white pl-8 pr-2 text-sm outline-none focus:border-primary"
        onChange={(event) => change(event.target.value)}
        value={locale}
      >
        <option value="en">{t("english")}</option>
        <option value="hi">{t("hindi")}</option>
      </select>
    </label>
  );
}
