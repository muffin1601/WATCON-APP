"use client";

import { callAction } from "@/lib/call-action";
import { Power, PowerOff } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { setDepartmentStatusAction } from "@/modules/departments/actions";

export function DepartmentStatusConfirm({ id, name, status, trigger }: { id: string; name: string; status: string; trigger?: ReactNode }) {
  const active = status === "ACTIVE";
  return (
    <ConfirmDialog
      trigger={
        trigger ?? (
          <Button variant="outline" size="sm">
            {active ? <PowerOff /> : <Power />} {active ? "Deactivate" : "Activate"}
          </Button>
        )
      }
      title={active ? "Deactivate department?" : "Activate department?"}
      description={
        active
          ? `${name} will no longer accept new members or task assignments. Existing memberships and task history are kept.`
          : `${name} will accept new members and task assignments again.`
      }
      confirmLabel={active ? "Deactivate" : "Activate"}
      destructive={active}
      onConfirm={async () => {
        const res = await callAction(setDepartmentStatusAction, id, active ? "INACTIVE" : "ACTIVE");
        if (res.ok) toast.success(active ? "Department deactivated" : "Department activated");
        else toast.error(res.error);
        return res.ok;
      }}
    />
  );
}
