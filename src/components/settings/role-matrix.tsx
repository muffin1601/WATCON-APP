"use client";

import { callAction } from "@/lib/call-action";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateRolePermissionsAction } from "@/modules/settings/actions";

type Perm = { key: string; name: string; group: string; description: string; superAdminOnly: boolean };

/** Super Admin edits Admin / User permissions. Super Admin always holds everything. */
export function RoleMatrix({ permissions, initial }: { permissions: Perm[]; initial: { ADMIN: string[]; USER: string[] } }) {
  const [grants, setGrants] = useState(initial);
  const [busy, setBusy] = useState<"ADMIN" | "USER" | null>(null);
  const groups = [...new Set(permissions.map((p) => p.group))];

  function toggle(role: "ADMIN" | "USER", key: string, on: boolean) {
    setGrants((g) => ({ ...g, [role]: on ? [...g[role], key] : g[role].filter((k) => k !== key) }));
  }

  async function save(role: "ADMIN" | "USER") {
    setBusy(role);
    const res = await callAction(updateRolePermissionsAction, { role, permissions: grants[role] });
    setBusy(null);
    if (res.ok) toast.success(`${role === "ADMIN" ? "Admin" : "User"} permissions saved. They apply on the next request.`);
    else toast.error(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Permission</th>
              <th className="w-28 px-3 py-2 text-center font-medium">Super Admin</th>
              <th className="w-24 px-3 py-2 text-center font-medium">Admin</th>
              <th className="w-24 px-3 py-2 text-center font-medium">User</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g} className="divide-y border-t">
              <tr className="bg-muted/20">
                <th colSpan={4} className="px-4 py-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g}</th>
              </tr>
              {permissions.filter((p) => p.group === g).map((p) => (
                <tr key={p.key}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </td>
                  <td className="text-center"><Checkbox checked disabled aria-label={`Super Admin: ${p.name}`} /></td>
                  {(["ADMIN", "USER"] as const).map((role) => (
                    <td key={role} className="text-center">
                      {p.superAdminOnly ? (
                        <Lock className="mx-auto size-3.5 text-muted-foreground" aria-label="Super Admin only" />
                      ) : (
                        <Checkbox checked={grants[role].includes(p.key)} onCheckedChange={(v) => toggle(role, p.key, v === true)} aria-label={`${role}: ${p.name}`} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save("ADMIN")} disabled={busy !== null}>{busy === "ADMIN" && <Loader2 className="animate-spin" />} Save Admin permissions</Button>
        <Button variant="outline" onClick={() => save("USER")} disabled={busy !== null}>{busy === "USER" && <Loader2 className="animate-spin" />} Save User permissions</Button>
      </div>
      <p className="text-xs text-muted-foreground"><Lock className="inline size-3" /> Locked permissions can only be held by Super Admins and cannot be granted to other roles.</p>
    </div>
  );
}
