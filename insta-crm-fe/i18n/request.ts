import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const locales = ["en", "hi"] as const;

export default getRequestConfig(async () => {
  const requested = cookies().get("CRM_LOCALE")?.value;
  const locale = locales.includes(requested as (typeof locales)[number])
    ? requested!
    : "en";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
