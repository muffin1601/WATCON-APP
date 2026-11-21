"use client";

import { Ban, CheckCircle2, FileMinus, Pencil, Send, ShieldAlert, ThumbsDown, ThumbsUp, Wallet } from "lucide-react";
import Link from "next/link";
import { DocActions, type DocActionDef } from "@/components/commercial/doc-actions";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/call-action";
import { billActionAction } from "@/modules/payables/actions";

type Can = { edit: boolean; submit: boolean; approve: boolean; override: boolean; approveBlockedReason: string | null; cancel: boolean; pay: boolean; note: boolean };

export function BillActions({ id, version, can, hasExceptions, projectId }: { id: string; version: number; can: Can; hasExceptions: boolean; projectId: string | null }) {
  const defs: DocActionDef[] = [];
  if (can.submit) defs.push({ key: "submit", label: "Submit for approval", icon: Send, variant: "default", success: "Submitted for approval." });
  if (can.approve && !hasExceptions) defs.push({ key: "approve", label: "Approve for payment", icon: ThumbsUp, variant: "default", confirm: { title: "Approve this bill for payment?", description: "The billed quantities are recorded against the purchase order and site receipts, and the bill can then be paid." }, success: "Bill approved." });
  if (can.override && hasExceptions) defs.push({ key: "override", label: "Approve with override", icon: ShieldAlert, variant: "default", confirm: { title: "Approve despite the differences?", description: "The bill does not match the purchase order / receipts. Your reason is kept in the audit history.", noteLabel: "Reason for override", noteRequired: true }, success: "Bill approved with override." });
  if (can.approve) defs.push({ key: "reject", label: "Reject", icon: ThumbsDown, confirm: { title: "Reject this bill?", description: "It goes back to accounts for correction.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Bill rejected." });
  if (can.cancel) defs.push({ key: "cancel", label: "Cancel bill", icon: Ban, variant: "ghost", confirm: { title: "Cancel this bill?", description: "Use this for a wrong or duplicate entry. Billed quantities are released back to the PO / receipts.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Bill cancelled." });
  return (
    <>
      {can.pay && (
        <Button asChild size="sm">
          <Link href={`/payments/new?direction=OUT&billId=${id}${projectId ? `&projectId=${projectId}` : ""}`}>
            <Wallet /> Record payment
          </Link>
        </Button>
      )}
      {can.edit && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/supplier-bills/${id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {can.note && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/notes/new?billId=${id}`}>
            <FileMinus /> Credit / debit note
          </Link>
        </Button>
      )}
      <DocActions actions={defs} run={(key, note) => callAction(billActionAction, id, (key === "override" ? "approve" : key) as never, { version, note, override: key === "override" })} />
      {can.approveBlockedReason && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3" />
          {can.approveBlockedReason}
        </span>
      )}
      {can.approve && hasExceptions && !can.override && <span className="text-xs text-amber-700">This bill has differences. Only a user allowed to override match exceptions can approve it; otherwise reject it.</span>}
    </>
  );
}
