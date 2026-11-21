"use client";

import { callAction } from "@/lib/call-action";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateRolePermissionsAction } from "@/modules/settings/actions";

type Perm = { key: string; name: string; group: string; description: string; superAdminOnly: boolean };
type RoleOpt = { key: string; label: string };

/**
 * Super Admin edits role grants. With many roles a full matrix is too wide for most
 * screens, so one role is edited at a time (the Super Admin column is always "all").
 */
export function RoleMatrix({ permissions, roles, initial }: { permissions: Perm[]; roles: RoleOpt[]; initial: Record<string, string[]> }) {
  const [grants, setGrants] = useState(initial);
  const [role, setRole] = useState(roles[0]!.key);
  const [busy, setBusy] = useState(false);
  const groups = [...new Set(permissions.map((p) => p.group))];
  const label = roles.find((r) => r.key === role)?.label ?? role;
  const current = grants[role] ?? [];

  function toggle(key: string, on: boolean) {
    setGrants((g) => ({ ...g, [role]: on ? [...(g[role] ?? []), key] : (g[role] ?? []).filter((k) => k !== key) }));
  }

  async function save() {
    setBusy(true);
    const res = await callAction(updateRolePermissionsAction, { role, permissions: current });
    setBusy(false);
    if (res.ok) toast.success(`${label} permissions saved. They apply on the next request.`);
    else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="role-pick" className="text-sm font-medium">
          Role
        </label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="role-pick" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{current.length} permissions granted</span>
        <Button className="ml-auto" onClick={save} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save {label} permissions
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Permission</th>
              <th className="w-28 px-3 py-2 text-center font-medium">Super Admin</th>
              <th className="w-32 px-3 py-2 text-center font-medium">{label}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g} className="divide-y border-t">
              <tr className="bg-muted/20">
                <th colSpan={3} className="px-4 py-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {g}
                </th>
              </tr>
              {permissions
                .filter((p) => p.group === g)
                .map((p) => (
                  <tr key={p.key}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </td>
                    <td className="text-center">
                      <Checkbox checked disabled aria-label={`Super Admin: ${p.name}`} />
                    </td>
                    <td className="text-center">
                      {p.superAdminOnly ? (
                        <Lock className="mx-auto size-3.5 text-muted-foreground" aria-label="Super Admin only" />
                      ) : (
                        <Checkbox checked={current.includes(p.key)} onCheckedChange={(v) => toggle(p.key, v === true)} aria-label={`${label}: ${p.name}`} />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        <Lock className="inline size-3" /> Locked permissions can only be held by Super Admins and cannot be granted to other roles.
      </p>
    </div>
  );
}
