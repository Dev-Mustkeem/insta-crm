import { defineConfig } from "@neon/config/v1";

/**
 * Declares the branch-scoped Neon infrastructure used by Insta CRM.
 *
 * @returns The Neon infrastructure configuration.
 */
export default defineConfig({
  preview: {
    buckets: {
      "insta-crm": { access: "private" },
    },
  },
});
