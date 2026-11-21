"use client";

import { Ban, Link2, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DocActions } from "@/components/commercial/doc-actions";
import { Field } from "@/components/forms/field";
import { FormDialog } from "@/components/shared/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/call-action";
import { formatDate } from "@/lib/format";
import { cmpMoney, formatINR } from "@/lib/money";
import { allocatePaymentAction, cancelPaymentAction, reverseAllocationAction } from "@/modules/payables/actions";
import type { OpenDoc } from "./payment-form";

export function PaymentActions({ id, version, can }: { id: string; version: number; can: { cancel: boolean } }) {
  if (!can.cancel) return null;
  return (
    <DocActions
      actions={[{ key: "cancel", label: "Cancel payment", icon: Ban, variant: "ghost", confirm: { title: "Cancel this payment?", description: "Use this for a bounced cheque or a wrong entry. All its allocations are reversed and the bills / invoices become payable again.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Payment cancelled." }]}
      run={(_k, note) => callAction(cancelPaymentAction, id, version, note ?? "")}
    />
  );
}

export function AllocateAdvance({ paymentId, unallocated, docs, direction }: { paymentId: string; unallocated: string; docs: OpenDoc[]; direction: "OUT" | "IN" }) {
  const router = useRouter();
  const [docId, setDocId] = useState<string>(docs[0]?.id ?? "");
  const doc = docs.find((d) => d.id === docId);
  const suggested = doc ? (cmpMoney(doc.outstanding, unallocated) < 0 ? doc.outstanding : unallocated) : "";
  const [amount, setAmount] = useState(suggested);
  const [busy, setBusy] = useState(false);
  return (
    <FormDialog
      title={`Allocate the advance (${formatINR(unallocated)})`}
      description={direction === "OUT" ? "Apply the unallocated part of this payment to an approved bill of the same supplier and project." : "Apply the unallocated part of this receipt to an issued invoice of the same client and project."}
      trigger={
        <Button size="sm" disabled={!docs.length} title={docs.length ? undefined : "Nothing open to allocate to"}>
          <Link2 /> Allocate advance
        </Button>
      }
    >
      {(close) => (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await callAction(allocatePaymentAction, paymentId, { documentId: docId, amount });
            setBusy(false);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Allocated.");
            close();
            router.refresh();
          }}
        >
          <Field id="alloc-doc" label={direction === "OUT" ? "Bill" : "Invoice"} required>
            <select
              id="alloc-doc"
              className="h-9 w-full rounded-md border bg-card px-2 text-sm"
              value={docId}
              onChange={(e) => {
                setDocId(e.target.value);
                const d = docs.find((x) => x.id === e.target.value);
                if (d) setAmount(cmpMoney(d.outstanding, unallocated) < 0 ? d.outstanding : unallocated);
              }}
            >
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.number}
                  {d.ref ? ` (inv ${d.ref})` : ""} · due {formatDate(d.dueDate)} · {formatINR(d.outstanding)} outstanding
                </option>
              ))}
            </select>
          </Field>
          <Field id="alloc-amt" label="Amount ₹" required>
            <Input id="alloc-amt" inputMode="decimal" className="text-right" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !docId}>
              {busy && <Loader2 className="animate-spin" />}
              Allocate
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  );
}

export function ReverseAllocation({ allocationId, label }: { allocationId: string; label: string }) {
  return (
    <DocActions
      actions={[{ key: "reverse", label: "Reverse", icon: Undo2, variant: "ghost", confirm: { title: `Reverse the allocation to ${label}?`, description: "The amount goes back to this payment as an advance and the document becomes payable again. The history is kept.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Allocation reversed." }]}
      run={(_k, note) => callAction(reverseAllocationAction, allocationId, note ?? "")}
    />
  );
}
