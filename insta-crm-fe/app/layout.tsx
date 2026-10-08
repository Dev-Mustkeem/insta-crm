import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { HindiTranslator } from "@/components/i18n/hindi-translator";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Insta ICT Solutions CRM", template: "%s | Insta ICT Solutions CRM" },
  description: "Insta ICT Solutions customer relationship management portal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003a62",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {locale === "hi" ? <HindiTranslator /> : null}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
