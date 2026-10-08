import type { AccessLevel, AppPage, Role } from "@prisma/client";

export const APPLICATION_PAGES: readonly AppPage[] = [
  "DASHBOARD",
  "EVIDENCE_VAULT",
  "EMAIL",
  "LEADS",
  "CONTACTS",
  "BROADCASTS",
  "PIPELINE",
  "TASKS",
  "BILLING",
  "AUDIT",
  "USER_MANAGEMENT",
] as const;

const NO_ACCESS: Record<AppPage, AccessLevel> = Object.fromEntries(
  APPLICATION_PAGES.map((page) => [page, "NONE"]),
) as Record<AppPage, AccessLevel>;

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Record<AppPage, AccessLevel>> = {
  SUPER_ADMIN: Object.fromEntries(
    APPLICATION_PAGES.map((page) => [page, "WRITE"]),
  ) as Record<AppPage, AccessLevel>,
  OWNER: {
    ...NO_ACCESS,
    DASHBOARD: "WRITE",
    EVIDENCE_VAULT: "WRITE",
    EMAIL: "WRITE",
    LEADS: "WRITE",
    CONTACTS: "WRITE",
    BROADCASTS: "WRITE",
    PIPELINE: "WRITE",
    TASKS: "WRITE",
    BILLING: "WRITE",
    AUDIT: "WRITE",
  },
  STAFF: {
    ...NO_ACCESS,
    EVIDENCE_VAULT: "WRITE",
    EMAIL: "WRITE",
    LEADS: "WRITE",
    CONTACTS: "WRITE",
    PIPELINE: "WRITE",
    TASKS: "WRITE",
  },
  ACCOUNTANT: {
    ...NO_ACCESS,
    DASHBOARD: "READ",
    BILLING: "WRITE",
  },
};

/**
 * Resolves a complete permission matrix using explicit grants before role defaults.
 *
 * @param role - Organization role assigned to the user.
 * @param permissions - Explicit permission records stored for the user.
 * @returns One permission entry for every application page.
 */
export function resolvePagePermissions(
  role: Role,
  permissions: ReadonlyArray<{ page: AppPage; access: AccessLevel }>,
) {
  const explicit = new Map(permissions.map((permission) => [permission.page, permission.access]));
  return APPLICATION_PAGES.map((page) => ({
    page,
    access: explicit.get(page) ?? DEFAULT_ROLE_PERMISSIONS[role][page],
  }));
}
