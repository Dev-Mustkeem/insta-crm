import type { ContactSource } from "@insta-crm/shared-types";

// Keep the currently offered source choices local to the web app so the
// contacts UI does not depend on a freshly rebuilt shared-types runtime bundle.
export const CONTACT_SOURCE_OPTIONS: ContactSource[] = ["gmail"];

export const contactSourceLabels: Record<ContactSource, string> = {
  gmail: "Gmail",
  whatsapp: "WhatsApp",
  website: "Website",
  marketplace: "Marketplace",
  "walk-in": "Walk-in",
  referral: "Referral",
  other: "Other",
};

export function whatsappHref(phone: string): string {
  let digits = phone.replace(/D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = "91" + digits.slice(1);
  }
  return "https://wa.me/" + digits;
}

export function contactInitials(name: string): string {
  return name
    .split(/s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}
