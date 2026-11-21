"use client";

import { Ban, PackageCheck, Pencil, RotateCcw, Send, ThumbsDown, Truck, Undo2, Trash2, CircleCheck } from "lucide-react";
import Link from "next/link";
import { DocActions, type DocActionDef } from "@/components/commercial/doc-actions";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { challanActionAction, grnActionAction, postGrnAction } from "@/modules/stores/actions";

type GrnCan = { edit: boolean; submit: boolean; post: boolean; postBlockedReason: string | null; reject: boolean; cancel: boolean; reverse: boolean };

export function GrnActions({ id, version, can }: { id: string; version: number; can: GrnCan }) {
  const defs: DocActionDef[] = [];
  if (can.submit) defs.push({ key: "submit", label: "Submit for verification", icon: Send, variant: "default", success: "Receipt submitted for verification." });
  if (can.post) defs.push({ key: "post", label: "Verify & add to stock", icon: PackageCheck, variant: "default", confirm: { title: "Verify and post this receipt?", description: "The accepted quantities are added to the site stock and the purchase order is updated. This cannot be edited afterwards (it can only be reversed)." }, success: "Receipt posted — stock updated." });
  if (can.reject) defs.push({ key: "reject", label: "Send back", icon: ThumbsDown, confirm: { title: "Send this receipt back for correction?", description: "The person who recorded it can fix the quantities and resubmit.", noteLabel: "What needs correcting", noteRequired: true }, success: "Receipt sent back for correction." });
  if (can.reverse) defs.push({ key: "reverse", label: "Reverse", icon: RotateCcw, confirm: { title: "Reverse this posted receipt?", description: "Opposite stock entries are posted and the purchase order goes back to pending. The original entries stay in the ledger for audit.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Receipt reversed." });
  if (can.cancel) defs.push({ key: "cancel", label: "Cancel", icon: Ban, variant: "ghost", confirm: { title: "Cancel this receipt?", description: "Nothing was added to stock yet. This cannot be undone.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Receipt cancelled." });
  return (
    <>
      {can.edit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/site-receipts/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      <DocActions actions={defs} run={(key, note) => (key === "post" ? callAction(postGrnAction, id, version) : callAction(grnActionAction, id, key as "submit" | "reject" | "cancel" | "reverse", { version, note }))} />
      {can.postBlockedReason && <span className="text-xs text-muted-foreground">{can.postBlockedReason}</span>}
    </>
  );
}

type ChallanCan = { dispatch: boolean; cancel: boolean; deliver: boolean; receive: boolean; closeDiscrepancy: boolean; writeOff: boolean };

export function ChallanActions({ id, version, can, internal }: { id: string; version: number; can: ChallanCan; internal: boolean }) {
  const defs: DocActionDef[] = [];
  if (can.dispatch) defs.push({ key: "dispatch", label: "Dispatch", icon: Truck, variant: "default", confirm: { title: "Dispatch this challan?", description: internal ? "Stock leaves the source location and shows as “in transit” until the destination records a receipt." : "Stock is deducted from the source location now." }, success: "Challan dispatched." });
  if (can.deliver) defs.push({ key: "deliver", label: "Confirm delivery", icon: CircleCheck, variant: "default", confirm: { title: "Confirm delivery", description: "Record who received the material. Attach the signed challan / proof of delivery afterwards.", noteLabel: "Received by (name)", input: true }, success: "Delivery confirmed." });
  if (can.closeDiscrepancy) {
    defs.push({ key: "close_return", label: "Close – return shortfall to source", icon: Undo2, confirm: { title: "Return the undelivered quantity to the source?", description: "Whatever is still in transit goes back to the source location and the challan is closed.", noteLabel: "Explanation", noteRequired: true }, success: "Challan closed — shortfall returned to source." });
    if (can.writeOff) defs.push({ key: "close_writeoff", label: "Close – write off shortfall", icon: Trash2, confirm: { title: "Write off the undelivered quantity?", description: "Whatever is still in transit is written off as lost and the challan is closed. This is recorded in the audit history.", noteLabel: "Explanation", noteRequired: true, destructive: true }, success: "Challan closed — shortfall written off." });
  }
  if (can.cancel) defs.push({ key: "cancel", label: "Cancel", icon: Ban, variant: "ghost", confirm: { title: "Cancel this challan?", description: "It has not been dispatched, so no stock moved.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Challan cancelled." });
  return (
    <>
      {can.receive && (
        <Button asChild size="sm">
          <Link href={`/site-receipts/new?challanId=${id}`}>
            <PackageCheck /> Receive at destination
          </Link>
        </Button>
      )}
      <DocActions
        actions={defs}
        run={(key, note) => {
          if (key === "close_return" || key === "close_writeoff") return callAction(challanActionAction, id, "close_discrepancy", { version, note, resolution: key === "close_return" ? "RETURN" : "WRITE_OFF" });
          if (key === "deliver") return callAction(challanActionAction, id, "deliver", { version, receiverName: note });
          return callAction(challanActionAction, id, key as "dispatch" | "cancel", { version, note });
        }}
      />
    </>
  );
}
