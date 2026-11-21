"use client";

import { Ban, CheckCircle2, Loader2, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DocActions, type DocActionDef } from "@/components/commercial/doc-actions";
import { SingleSelect } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { callAction } from "@/lib/call-action";
import { GST_RATES } from "@/lib/gst";
import { addMoney, formatINR, pctOf } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createNoteAction, noteActionAction } from "@/modules/payables/actions";

type Target = { id: string; label: string; project: string | null; outstanding: string; taxMode: string };

const KINDS = [
  { key: "SUPPLIER_CREDIT", role: "SUPPLIER", type: "CREDIT", title: "Supplier's credit note", text: "The supplier sent us a credit note (rate difference, discount, short supply)." },
  { key: "SUPPLIER_DEBIT", role: "SUPPLIER", type: "DEBIT", title: "Our debit note to a supplier", text: "We are charging the supplier back (returned / rejected material, penalty)." },
  { key: "CLIENT_CREDIT", role: "CLIENT", type: "CREDIT", title: "Credit note to a client", text: "Reduce what a client owes on an issued invoice." },
] as const;

export function NoteForm({ bills, invoices, initialBillId, initialInvoiceId, today }: { bills: Target[]; invoices: Target[]; initialBillId: string | null; initialInvoiceId: string | null; today: string }) {
  const router = useRouter();
  const allowed = KINDS.filter((k) => (k.role === "SUPPLIER" ? bills.length > 0 || !!initialBillId : invoices.length > 0 || !!initialInvoiceId));
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>(initialInvoiceId ? "CLIENT_CREDIT" : (allowed[0]?.key ?? "SUPPLIER_CREDIT"));
  const k = KINDS.find((x) => x.key === kind)!;
  const [docId, setDocId] = useState<string | null>(k.role === "SUPPLIER" ? initialBillId : initialInvoiceId);
  const [v, setV] = useState({ noteDate: today, partyNoteRef: "", reason: "", taxable: "", gstRate: "18" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty && !busy);
  const set = (p: Partial<typeof v>) => {
    setDirty(true);
    setV((s) => ({ ...s, ...p }));
  };
  const targets = k.role === "SUPPLIER" ? bills : invoices;
  const target = targets.find((t) => t.id === docId);
  let total: string | null = null;
  try {
    total = v.taxable ? addMoney(v.taxable, pctOf(v.taxable, v.gstRate)) : null;
  } catch {
    total = null;
  }

  return (
    <form
      className="space-y-4 pb-24"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await callAction(createNoteAction, { noteType: k.type, partyRole: k.role, supplierBillId: k.role === "SUPPLIER" ? docId : null, clientInvoiceId: k.role === "CLIENT" ? docId : null, ...v });
        setBusy(false);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.error(res.error);
          return;
        }
        setDirty(false);
        toast.success("Note saved as draft. An approver must approve it before it reduces the balance.");
        router.push(`/notes/${res.data.id}`);
      }}
    >
      <FormSection title="1. What kind of note?">
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
          {KINDS.map((o) => {
            const disabled = !allowed.some((a) => a.key === o.key);
            return (
              <button
                key={o.key}
                type="button"
                disabled={disabled}
                aria-pressed={kind === o.key}
                onClick={() => {
                  setKind(o.key);
                  setDocId(null);
                }}
                className={cn("rounded-xl border p-3 text-left transition-colors disabled:opacity-40", kind === o.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
              >
                <span className="block font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.text}</span>
              </button>
            );
          })}
        </div>
        <Field id="note-doc" label={k.role === "SUPPLIER" ? "Supplier bill" : "Client invoice"} required error={errors.supplierBillId ?? errors.clientInvoiceId} className="sm:col-span-2" help={target ? `Project ${target.project ?? "—"} · outstanding ${formatINR(target.outstanding)}` : "Only approved / issued documents with a balance are listed."}>
          <SingleSelect id="note-doc" options={targets.map((t) => ({ value: t.id, label: t.label, hint: `${t.project ?? ""} · ${formatINR(t.outstanding)}` }))} value={docId} onChange={(x) => setDocId(x)} placeholder="Select the document" />
        </Field>
      </FormSection>
      <FormSection title="2. Amount and reason">
        <Field id="note-date" label="Note date" required error={errors.noteDate}>
          <Input id="note-date" type="date" value={v.noteDate} onChange={(e) => set({ noteDate: e.target.value })} />
        </Field>
        <Field id="note-ref" label={k.role === "SUPPLIER" && k.type === "CREDIT" ? "Supplier's credit note no." : "Reference"} error={errors.partyNoteRef}>
          <Input id="note-ref" value={v.partyNoteRef} onChange={(e) => set({ partyNoteRef: e.target.value })} />
        </Field>
        <Field id="note-taxable" label="Taxable amount ₹" required error={errors.taxable}>
          <Input id="note-taxable" inputMode="decimal" className="text-right" value={v.taxable} onChange={(e) => set({ taxable: e.target.value })} />
        </Field>
        <Field id="note-gst" label="GST %" required error={errors.gstRate}>
          <select id="note-gst" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={v.gstRate} onChange={(e) => set({ gstRate: e.target.value })}>
            {GST_RATES.map((g) => (
              <option key={g} value={g}>
                {g}%
              </option>
            ))}
          </select>
        </Field>
        <Field id="note-reason" label="Reason" required error={errors.reason} className="sm:col-span-2">
          <Textarea id="note-reason" rows={2} value={v.reason} placeholder="e.g. Rate difference on 50 bags @ ₹5" onChange={(e) => set({ reason: e.target.value })} />
        </Field>
        <p className="text-sm sm:col-span-2">
          Note total incl. GST: <span className="font-semibold tabular-nums">{formatINR(total)}</span>
        </p>
      </FormSection>
      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !docId}>
          {busy && <Loader2 className="animate-spin" />}
          Save draft
        </Button>
      </div>
    </form>
  );
}

export function NoteActions({ id, version, can }: { id: string; version: number; can: { approve: boolean; approveBlockedReason: string | null; cancel: boolean } }) {
  const defs: DocActionDef[] = [];
  if (can.approve) defs.push({ key: "approve", label: "Approve & apply", icon: ThumbsUp, variant: "default", confirm: { title: "Approve this note?", description: "The amount is applied to the bill / invoice immediately and reduces what is outstanding." }, success: "Note approved and applied." });
  if (can.cancel) defs.push({ key: "cancel", label: "Cancel note", icon: Ban, variant: "ghost", confirm: { title: "Cancel this note?", description: "If it was applied, the amount is added back to the bill / invoice.", noteLabel: "Reason", noteRequired: true, destructive: true }, success: "Note cancelled." });
  return (
    <>
      <DocActions actions={defs} run={(key, note) => callAction(noteActionAction, id, key as "approve" | "cancel", { version, note })} />
      {can.approveBlockedReason && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3" />
          {can.approveBlockedReason}
        </span>
      )}
    </>
  );
}
