"use client";

import { Ban, CheckCircle2, FilePen, Lock, PackageCheck, Pencil, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { DocActions, type DocActionDef } from "@/components/commercial/doc-actions";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { poActionAction } from "@/modules/procurement/actions";

type Can = { edit: boolean; submit: boolean; approve: boolean; approveBlockedReason: string | null; send: boolean; acknowledge: boolean; amend: boolean; cancel: boolean; close: boolean; receive: boolean; bill: boolean };

export function PoActions({ id, version, can }: { id: string; version: number; can: Can }) {
  const defs: DocActionDef[] = [];
  if (can.submit) defs.push({ key: "submit", label: "Submit for approval", icon: Send, variant: "default", success: "Submitted for approval." });
  if (can.approve) {
    defs.push({ key: "approve", label: "Approve", icon: ThumbsUp, variant: "default", confirm: { title: "Approve this purchase order?", description: "The supplier can then be sent the PO and material can be received against it." }, success: "Purchase order approved." });
    defs.push({ key: "reject", label: "Reject", icon: ThumbsDown, confirm: { title: "Reject this purchase order?", description: "It returns to the creator for changes.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Purchase order rejected." });
  }
  if (can.send) defs.push({ key: "send", label: "Mark sent", icon: Send, confirm: { title: "Mark as sent to the supplier?", description: "Share the PDF by email or WhatsApp first. This records that it was sent — the app does not send it for you.", noteLabel: "Sent via (e.g. email, WhatsApp)", input: true }, success: "Marked as sent." });
  if (can.acknowledge) defs.push({ key: "acknowledge", label: "Supplier acknowledged", icon: CheckCircle2, confirm: { title: "Record supplier acknowledgement", description: "Enter the supplier's confirmation reference (email, order no.).", noteLabel: "Acknowledgement reference", input: true }, success: "Acknowledgement recorded." });
  if (can.amend) defs.push({ key: "amend", label: "Amend", icon: FilePen, confirm: { title: "Open an amendment?", description: "The current version is saved to the revision history; the amended PO needs approval again. Received and billed quantities are kept.", noteLabel: "Reason for amendment", noteRequired: true }, success: "Amendment opened — edit and resubmit." });
  if (can.close) defs.push({ key: "close", label: "Short-close", icon: Lock, confirm: { title: "Short-close this purchase order?", description: "No further deliveries will be received. Unreceived quantity is released back to the requisition.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Purchase order closed." });
  if (can.cancel) defs.push({ key: "cancel", label: "Cancel", icon: Ban, variant: "ghost", confirm: { title: "Cancel this purchase order?", description: "This cannot be undone. Linked requisition quantities are released.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Purchase order cancelled." });
  return (
    <>
      {can.edit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/purchase-orders/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {can.receive && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/site-receipts/new?poId=${id}`}>
            <PackageCheck /> Receive material
          </Link>
        </Button>
      )}
      {can.bill && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/supplier-bills/new?poId=${id}`}>Enter supplier bill</Link>
        </Button>
      )}
      <DocActions actions={defs} run={(key, note) => callAction(poActionAction, id, key as never, { version, note, via: key === "send" ? note : null })} />
      {can.approveBlockedReason && <span className="text-xs text-muted-foreground">{can.approveBlockedReason}</span>}
    </>
  );
}
