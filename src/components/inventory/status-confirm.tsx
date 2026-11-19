"use client";

import { Power, PowerOff } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { setBrandStatusAction, setItemStatusAction } from "@/modules/inventory/actions";

export function InventoryStatusConfirm({ kind, id, name, status, trigger }: { kind: "item" | "brand"; id: string; name: string; status: string; trigger?: ReactNode }) {
  const active = status === "ACTIVE";
  const label = kind === "item" ? "item" : "brand";
  return (
    <ConfirmDialog
      trigger={
        trigger ?? (
          <Button variant="outline" size="sm">
            {active ? <PowerOff /> : <Power />} {active ? "Deactivate" : "Activate"}
          </Button>
        )
      }
      title={active ? `Deactivate ${label}?` : `Activate ${label}?`}
      description={active ? `${name} will not accept new stock movements${kind === "brand" ? " or item links" : ""}. Stock balances and history are kept.` : `${name} will accept new stock movements again.`}
      confirmLabel={active ? "Deactivate" : "Activate"}
      destructive={active}
      onConfirm={async () => {
        const action = kind === "item" ? setItemStatusAction : setBrandStatusAction;
        const res = await callAction(action, id, active ? "INACTIVE" : "ACTIVE");
        if (res.ok) toast.success(active ? `${kind === "item" ? "Item" : "Brand"} deactivated` : `${kind === "item" ? "Item" : "Brand"} activated`);
        else toast.error(res.error);
        return res.ok;
      }}
    />
  );
}
