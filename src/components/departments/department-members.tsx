"use client";

import { callAction } from "@/lib/call-action";
import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SingleSelect, personOptions, type PersonOption } from "@/components/forms/combobox";
import { RecordStatusBadge } from "@/components/shared/badges";
import { ConfirmDialog, FormDialog } from "@/components/shared/dialogs";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { addDepartmentMemberAction, removeDepartmentMemberAction } from "@/modules/departments/actions";

export type DepartmentMemberRow = { id: string; fullName: string; designation: string | null; employeeCode: string; status: string; isPrimary: boolean; isHead: boolean };

function AddMemberForm({ departmentId, candidates, onDone }: { departmentId: string; candidates: PersonOption[]; onDone: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    const res = await callAction(addDepartmentMemberAction, { departmentId, userId });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Member added");
    onDone();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="add-member" className="text-sm font-medium">
          Team member
        </label>
        <SingleSelect id="add-member" options={personOptions(candidates)} value={userId} onChange={setUserId} placeholder="Select a person" searchPlaceholder="Search people…" emptyText="No eligible people." />
        <p className="text-xs text-muted-foreground">People who already belong to this department are not listed. A member&apos;s first department becomes their primary department.</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!userId || busy}>
          {busy && <Loader2 className="animate-spin" />} Add member
        </Button>
      </div>
    </form>
  );
}

export function DepartmentMembers({ departmentId, departmentName, members, totalMembers, candidates, canManage, canViewProfiles, active }: { departmentId: string; departmentName: string; members: DepartmentMemberRow[]; totalMembers: number; candidates: PersonOption[]; canManage: boolean; canViewProfiles: boolean; active: boolean }) {
  return (
    <section className="rounded-xl border bg-card" aria-labelledby="dept-members">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="dept-members" className="text-sm font-semibold">
          Team members <span className="ml-1 rounded-full bg-muted px-1.5 text-xs font-normal tabular-nums text-muted-foreground">{totalMembers}</span>
        </h2>
        {canManage && active && (
          <FormDialog
            title={`Add member to ${departmentName}`}
            trigger={
              <Button size="sm" variant="outline">
                <UserPlus /> Add member
              </Button>
            }
          >
            {(close) => <AddMemberForm departmentId={departmentId} candidates={candidates} onDone={close} />}
          </FormDialog>
        )}
      </div>
      {members.length === 0 ? (
        <EmptyState icon={Users} title="No members" description={canViewProfiles ? "No one belongs to this department yet." : "Member details are visible to administrators."} className="m-4 border-none" />
      ) : (
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {canViewProfiles ? (
                    <Link href={`/team-members/${m.id}`} className="font-medium hover:text-primary hover:underline">
                      {m.fullName}
                    </Link>
                  ) : (
                    <span className="font-medium">{m.fullName}</span>
                  )}
                  {m.isPrimary && <span className="rounded bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">Primary</span>}
                  {m.isHead && <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium">Head</span>}
                  {m.status !== "ACTIVE" && <RecordStatusBadge status={m.status} />}
                </div>
                <div className="truncate text-xs text-muted-foreground">{[m.employeeCode, m.designation].filter(Boolean).join(" · ")}</div>
              </div>
              {canManage && (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.fullName} from ${departmentName}`}>
                      <UserMinus />
                    </Button>
                  }
                  title="Remove member?"
                  description={`${m.fullName} will be removed from ${departmentName}. Their task history is not affected.${m.isPrimary ? " Their primary department will move to another membership, if any." : ""}`}
                  confirmLabel="Remove"
                  destructive
                  onConfirm={async () => {
                    const res = await callAction(removeDepartmentMemberAction, { departmentId, userId: m.id });
                    if (res.ok) toast.success("Member removed");
                    else toast.error(res.error);
                    return res.ok;
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
