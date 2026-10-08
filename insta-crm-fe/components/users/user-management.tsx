"use client";

import {
  ACCESS_LEVELS,
  APP_PAGES,
  type AccessLevel,
  type AppPage,
  type OrganizationUser,
  type PagePermission,
  type UserManagementResponse,
  type UserRole,
} from "@insta-crm/shared-types";
import { CheckCircle2, Loader2, MailPlus, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

const MANAGED_ROLES = ["OWNER", "STAFF", "ACCOUNTANT"] as const;
type ManagedRole = (typeof MANAGED_ROLES)[number];

const PAGE_LABELS: Record<AppPage, string> = {
  DASHBOARD: "Dashboard",
  EVIDENCE_VAULT: "Evidence Vault",
  EMAIL: "Email & inbox",
  LEADS: "Leads",
  CONTACTS: "Contacts",
  BROADCASTS: "Broadcasts",
  PIPELINE: "Pipeline",
  TASKS: "Tasks",
  BILLING: "Billing & inventory",
  AUDIT: "Audit log",
  USER_MANAGEMENT: "User management",
};

const ROLE_DEFAULTS: Record<ManagedRole, Partial<Record<AppPage, AccessLevel>>> = {
  OWNER: Object.fromEntries(APP_PAGES.map((page) => [page, page === "USER_MANAGEMENT" ? "NONE" : "WRITE"])),
  STAFF: {
    EVIDENCE_VAULT: "WRITE",
    EMAIL: "WRITE",
    LEADS: "WRITE",
    CONTACTS: "WRITE",
    PIPELINE: "WRITE",
    TASKS: "WRITE",
  },
  ACCOUNTANT: { DASHBOARD: "READ", BILLING: "WRITE" },
};

/** Organization user and invitation administration workspace. */
export function UserManagement() {
  const [data, setData] = useState<UserManagementResponse | null>(null);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  /** Loads the current organization directory. */
  const load = useCallback(async () => {
    try {
      setError("");
      setData(await apiFetch<UserManagementResponse>("/users"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load users");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#0057A8]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users & access</h1>
          <p className="mt-1 text-sm text-slate-500">Invite team members and control read or write access per page.</p>
        </div>
        <Button onClick={() => setInviteOpen((open) => !open)} className="gap-2 bg-[#00A651] hover:bg-[#008f45]">
          <MailPlus className="h-4 w-4" />
          Invite user
        </Button>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {inviteOpen ? <InviteForm onComplete={() => { setInviteOpen(false); void load(); }} /> : null}

      <div className="grid gap-4">
        {data.users.map((user) => (
          <UserAccessCard key={user.id} user={user} onSaved={load} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invitations</CardTitle>
          <CardDescription>Invitation links expire 48 hours after they are sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.invitations.length === 0 ? <p className="text-sm text-slate-500">No invitations sent yet.</p> : null}
          {data.invitations.map((invitation) => {
            const expired = new Date(invitation.expiresAt) <= new Date();
            const status = invitation.acceptedAt ? "Accepted" : expired ? "Expired" : "Pending";
            return (
              <div key={invitation.id} className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium text-slate-800">{invitation.email}</p>
                  <p className="text-xs text-slate-500">{roleLabel(invitation.role)} · Sent {new Date(invitation.createdAt).toLocaleString()}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Accepted" ? "bg-green-100 text-green-700" : status === "Expired" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                  {status}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/** Invitation editor with role-based permission presets. */
function InviteForm({ onComplete }: { onComplete: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedRole>("STAFF");
  const [permissions, setPermissions] = useState(() => permissionsForRole("STAFF"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** Changes the role and applies its recommended page access. */
  function changeRole(nextRole: ManagedRole) {
    setRole(nextRole);
    setPermissions(permissionsForRole(nextRole));
  }

  /** Sends the invitation email. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/users/invitations", {
        method: "POST",
        body: JSON.stringify({ email, role, permissions }),
      });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send invitation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-[#00A651]/30">
      <CardHeader>
        <CardTitle className="text-lg">Invite a team member</CardTitle>
        <CardDescription>The recipient receives a secure email link to create their account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select id="invite-role" value={role} onChange={(event) => changeRole(event.target.value as ManagedRole)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">
                {MANAGED_ROLES.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
              </select>
            </div>
          </div>
          <PermissionEditor permissions={permissions} onChange={setPermissions} />
          <Button type="submit" disabled={loading} className="bg-[#00A651] hover:bg-[#008f45]">
            {loading ? "Sending invitation..." : "Send invitation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Editable access card for an existing organization user. */
function UserAccessCard({ user, onSaved }: { user: OrganizationUser; onSaved: () => Promise<void> }) {
  const managed = user.role !== "SUPER_ADMIN";
  const [role, setRole] = useState<ManagedRole>(
    user.role === "SUPER_ADMIN" ? "OWNER" : user.role,
  );
  const [active, setActive] = useState(user.active);
  const [permissions, setPermissions] = useState(user.permissions);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Applies a role preset while retaining explicit editability. */
  function changeRole(nextRole: ManagedRole) {
    setRole(nextRole);
    setPermissions(permissionsForRole(nextRole));
  }

  /** Persists the selected role, status, and page permissions. */
  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role, active, permissions }),
      });
      setEditing(false);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#0057A8]">
              {managed ? <UserRound className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{user.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{user.active ? "Active" : "Inactive"}</span>
              </div>
              <p className="text-sm text-slate-500">{user.email} · {roleLabel(user.role)}</p>
            </div>
          </div>
          {managed ? <Button variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel" : "Edit access"}</Button> : null}
        </div>

        {editing ? (
          <div className="mt-5 space-y-5 border-t pt-5">
            {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`role-${user.id}`}>Role</Label>
                <select id={`role-${user.id}`} value={role} onChange={(event) => changeRole(event.target.value as ManagedRole)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">
                  {MANAGED_ROLES.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 self-end rounded-md border p-3 text-sm font-medium">
                <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[#00A651]" />
                Active account
              </label>
            </div>
            <PermissionEditor permissions={permissions} onChange={setPermissions} />
            <Button onClick={save} disabled={saving} className="gap-2 bg-[#0057A8] hover:bg-[#00498d]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save access
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Page permission matrix shared by invitation and user editing forms. */
function PermissionEditor({ permissions, onChange }: { permissions: PagePermission[]; onChange: (permissions: PagePermission[]) => void }) {
  /** Updates one page without mutating the existing permission array. */
  function setAccess(page: AppPage, access: AccessLevel) {
    onChange(permissions.map((permission) => permission.page === page ? { ...permission, access } : permission));
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_8rem] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Page</span><span>Access</span>
      </div>
      <div className="divide-y rounded-lg border">
        {permissions.filter((permission) => permission.page !== "USER_MANAGEMENT").map((permission) => (
          <div key={permission.page} className="grid grid-cols-[1fr_8rem] items-center gap-3 px-3 py-2">
            <span className="text-sm text-slate-700">{PAGE_LABELS[permission.page]}</span>
            <select value={permission.access} onChange={(event) => setAccess(permission.page, event.target.value as AccessLevel)} className="h-9 rounded-md border bg-white px-2 text-sm">
              {ACCESS_LEVELS.map((access) => <option key={access} value={access}>{access === "NONE" ? "No access" : access === "READ" ? "Read" : "Read & write"}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Builds a complete permission matrix from a managed role preset. */
function permissionsForRole(role: ManagedRole): PagePermission[] {
  return APP_PAGES.map((page) => ({ page, access: ROLE_DEFAULTS[role][page] ?? "NONE" }));
}

/** Formats internal role values for display. */
function roleLabel(role: UserRole): string {
  return role === "SUPER_ADMIN" ? "Super admin" : role.charAt(0) + role.slice(1).toLowerCase();
}
