"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LinesEditor, TotalsPanel, emptyLine, safeTotals, type EditableLine } from "@/components/commercial/lines-editor";
import { SingleSelect } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { callAction } from "@/lib/call-action";
import { GST_STATES } from "@/lib/gst";
import { taxModeFor } from "@/lib/money";
import { newId } from "@/lib/utils";
import { createClientPoAction, updateClientPoAction } from "@/modules/sales/actions";

export type ClientOpt = { id: string; code: string; name: string; gstin: string | null; stateCode: string | null; paymentTermsDays: number | null; status: string };
export type ProjectOpt = { id: string; code: string; name: string };
type Milestone = { key: string; id?: string | null; name: string; percent: string; amount: string; dueDate: string };

export type CpoFormValues = {
  projectId: string | null;
  partyId: string | null;
  clientPoNumber: string;
  poDate: string;
  startDate: string;
  endDate: string;
  scope: string;
  paymentTerms: string;
  deliveryTerms: string;
  retentionPct: string;
  advanceAmount: string;
  advanceRecoveryPct: string;
  placeOfSupply: string | null;
  notes: string;
  lines: EditableLine[];
  milestones: Milestone[];
};

export function CpoForm({ initial, cpoId, version, revision, projects, clients, companyStateCode, lockProject }: { initial: CpoFormValues; cpoId?: string; version?: number; revision?: number; projects: ProjectOpt[]; clients: ClientOpt[]; companyStateCode: string | null; lockProject?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<CpoFormValues>({ ...initial, lines: initial.lines.length ? initial.lines : [{ ...emptyLine(), unit: "" }] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty && !busy);
  const set = (p: Partial<CpoFormValues>) => {
    setDirty(true);
    setV((s) => ({ ...s, ...p }));
  };
  const client = clients.find((c) => c.id === v.partyId);
  const mode = taxModeFor(companyStateCode, v.placeOfSupply ?? client?.stateCode);
  const totals = useMemo(() => safeTotals(v.lines, mode), [v.lines, mode]);
  const project = projects.find((p) => p.id === v.projectId);
  const setMs = (i: number, p: Partial<Milestone>) => set({ milestones: v.milestones.map((m, j) => (j === i ? { ...m, ...p } : m)) });

  async function save() {
    setBusy(true);
    const payload = { ...v, lines: v.lines.map((l) => ({ id: l.id ?? null, boqRef: l.links?.boqRef ?? null, itemId: l.links?.itemId ?? null, description: l.description, hsnSac: l.hsnSac, unit: l.unit, quantity: l.quantity, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate })), milestones: v.milestones.map(({ key: _k, ...m }) => m) };
    const res = cpoId ? await callAction(updateClientPoAction, cpoId, version!, payload) : await callAction(createClientPoAction, payload);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setDirty(false);
    toast.success(cpoId ? "Client PO saved." : "Client PO recorded as draft.");
    router.push(`/client-pos/${res.data.id}`);
  }

  return (
    <form className="space-y-4 pb-24" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
      {revision ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Revision {revision}: quantities already ordered or billed are protected — a line cannot go below them. The revised contract needs approval again.</p> : null}
      <FormSection title="Contract" description="The client's purchase / work order. Its quantities are the ceiling for sales orders, running bills and invoices.">
        <Field id="cpo-project" label="Project" required error={errors.projectId}>
          {lockProject && project ? (
            <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">{project.code} – {project.name}</p>
          ) : (
            <SingleSelect id="cpo-project" options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} value={v.projectId} onChange={(x) => set({ projectId: x })} allowClear={false} placeholder="Select project" invalid={!!errors.projectId} />
          )}
        </Field>
        <Field id="cpo-party" label="Client" required error={errors.partyId} help={client ? `Tax: ${mode === "INTRA" ? "CGST + SGST (same state)" : "IGST (inter-state)"}` : undefined}>
          <SingleSelect id="cpo-party" options={clients.map((c) => ({ value: c.id, label: c.name, hint: c.gstin ?? "Unregistered", disabled: c.status !== "ACTIVE" }))} value={v.partyId} onChange={(x) => set({ partyId: x })} allowClear={false} placeholder="Select client" invalid={!!errors.partyId} />
          <Link href="/parties/new?type=client" className="mt-1 inline-block text-xs text-primary hover:underline">+ New client</Link>
        </Field>
        <Field id="cpo-no" label="Client's PO / work-order number" required error={errors.clientPoNumber}>
          <Input id="cpo-no" value={v.clientPoNumber} onChange={(e) => set({ clientPoNumber: e.target.value })} placeholder="As printed on the client's PO" />
        </Field>
        <Field id="cpo-date" label="PO date" required error={errors.poDate}>
          <Input id="cpo-date" type="date" value={v.poDate} onChange={(e) => set({ poDate: e.target.value })} />
        </Field>
        <Field id="cpo-start" label="Start date" error={errors.startDate}>
          <Input id="cpo-start" type="date" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field id="cpo-end" label="Completion date" error={errors.endDate}>
          <Input id="cpo-end" type="date" value={v.endDate} onChange={(e) => set({ endDate: e.target.value })} />
        </Field>
        <Field id="cpo-pos" label="Place of supply" error={errors.placeOfSupply} help="Defaults to the client's state.">
          <SingleSelect id="cpo-pos" options={Object.entries(GST_STATES).map(([code, name]) => ({ value: code, label: name, hint: code }))} value={v.placeOfSupply} onChange={(x) => set({ placeOfSupply: x })} placeholder={client?.stateCode ? `Client state (${GST_STATES[client.stateCode] ?? client.stateCode})` : "Client state"} />
        </Field>
        <Field id="cpo-scope" label="Scope of work" error={errors.scope} className="sm:col-span-2">
          <Textarea id="cpo-scope" rows={2} value={v.scope} onChange={(e) => set({ scope: e.target.value })} />
        </Field>
      </FormSection>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Contract lines (BOQ)</h2>
          <p className="text-xs text-muted-foreground">One line per BOQ item. Quantities here are the most that can ever be ordered or billed.</p>
        </div>
        <LinesEditor variant="text" lines={v.lines} onChange={(lines) => set({ lines })} mode={mode} errors={errors} />
        <div className="flex justify-end"><TotalsPanel totals={totals} mode={mode} className="w-full max-w-xs rounded-xl border bg-card p-3" /></div>
      </section>

      <FormSection title="Commercial terms" description="Used to work out deductions on every running bill.">
        <Field id="cpo-ret" label="Retention %" error={errors.retentionPct} help="Held back from each bill until completion.">
          <Input id="cpo-ret" inputMode="decimal" value={v.retentionPct} onChange={(e) => set({ retentionPct: e.target.value })} placeholder="0" />
        </Field>
        <Field id="cpo-adv" label="Mobilisation advance (₹)" error={errors.advanceAmount}>
          <Input id="cpo-adv" inputMode="decimal" value={v.advanceAmount} onChange={(e) => set({ advanceAmount: e.target.value })} placeholder="0" />
        </Field>
        <Field id="cpo-advrec" label="Advance recovery % per bill" error={errors.advanceRecoveryPct} help="Never recovers more than the advance.">
          <Input id="cpo-advrec" inputMode="decimal" value={v.advanceRecoveryPct} onChange={(e) => set({ advanceRecoveryPct: e.target.value })} placeholder="0" />
        </Field>
        <Field id="cpo-pay" label="Payment terms" error={errors.paymentTerms} help={client?.paymentTermsDays != null ? `Client default: ${client.paymentTermsDays} days` : undefined}>
          <Input id="cpo-pay" value={v.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
        </Field>
        <Field id="cpo-del" label="Delivery terms" error={errors.deliveryTerms}>
          <Input id="cpo-del" value={v.deliveryTerms} onChange={(e) => set({ deliveryTerms: e.target.value })} />
        </Field>
        <Field id="cpo-notes" label="Notes" error={errors.notes} className="sm:col-span-2">
          <Textarea id="cpo-notes" rows={2} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </FormSection>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Payment milestones <span className="font-normal text-muted-foreground">(optional)</span></h2>
          <p className="text-xs text-muted-foreground">Give each milestone a percent of the contract or a fixed amount.</p>
        </div>
        {v.milestones.map((m, i) => (
          <div key={m.key} className="grid gap-2 sm:grid-cols-[1fr_100px_140px_150px_auto]">
            <Input aria-label={`Milestone ${i + 1} name`} placeholder="e.g. On completion of slab" value={m.name} onChange={(e) => setMs(i, { name: e.target.value })} aria-invalid={!!errors[`milestones.${i}.name`]} />
            <Input aria-label={`Milestone ${i + 1} percent`} inputMode="decimal" placeholder="%" value={m.percent} onChange={(e) => setMs(i, { percent: e.target.value, amount: "" })} />
            <Input aria-label={`Milestone ${i + 1} amount`} inputMode="decimal" placeholder="or ₹ amount" value={m.amount} onChange={(e) => setMs(i, { amount: e.target.value, percent: "" })} />
            <Input aria-label={`Milestone ${i + 1} due date`} type="date" value={m.dueDate} onChange={(e) => setMs(i, { dueDate: e.target.value })} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove milestone ${i + 1}`} onClick={() => set({ milestones: v.milestones.filter((_, j) => j !== i) })}><Trash2 /></Button>
            {(errors[`milestones.${i}.percent`] || errors[`milestones.${i}.name`]) && <p className="text-xs text-destructive sm:col-span-5">{errors[`milestones.${i}.percent`] ?? errors[`milestones.${i}.name`]}</p>}
          </div>
        ))}
        {errors.milestones && <p className="text-xs text-destructive">{errors.milestones}</p>}
        <Button type="button" size="sm" variant="outline" onClick={() => set({ milestones: [...v.milestones, { key: newId(), name: "", percent: "", amount: "", dueDate: "" }] })}><Plus /> Add milestone</Button>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={busy}>{cpoId ? "Save" : "Save draft"}</Button>
      </div>
    </form>
  );
}
