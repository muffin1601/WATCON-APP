"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { ItemBrandOpt } from "@/components/commercial/lines-editor";
import { MultiSelect, SingleSelect } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { callAction } from "@/lib/call-action";
import { formatQty } from "@/lib/format";
import { newId } from "@/lib/utils";
import { createRfqAction } from "@/modules/procurement/actions";
import type { LocOpt, PartyOpt, ProjectOpt } from "./po-form";

export type RfqLineValue = { key: string; itemBrandId: string | null; quantity: string; acceptableBrands: string; specifications: string; prLineId: string | null };
type Values = { projectId: string | null; prId: string | null; title: string; deliveryLocationId: string | null; requiredBy: string; responseDue: string; supplierIds: string[]; lines: RfqLineValue[] };

export const emptyRfqLine = (): RfqLineValue => ({ key: newId(), itemBrandId: null, quantity: "", acceptableBrands: "", specifications: "", prLineId: null });

export function RfqForm({ initial, lockProject, prNumber, suppliers, projects, locations, options }: { initial: Values; lockProject: boolean; prNumber?: string | null; suppliers: PartyOpt[]; projects: ProjectOpt[]; locations: LocOpt[]; options: ItemBrandOpt[] }) {
  const router = useRouter();
  const siteOf = (pid: string | null) => locations.find((l) => l.type === "SITE" && l.status === "ACTIVE" && l.projectId === pid)?.id ?? null;
  const [v, setV] = useState({ ...initial, deliveryLocationId: initial.deliveryLocationId ?? siteOf(initial.projectId), lines: initial.lines.length ? initial.lines : [emptyRfqLine()], deliveryAddress: "", paymentTerms: "", freightTerms: "", taxTerms: "", validityDays: "30", specifications: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [more, setMore] = useState(false);
  useUnsavedWarning(dirty && !busy);
  const set = (p: Partial<typeof v>) => {
    setDirty(true);
    setV((s) => ({ ...s, ...p }));
  };
  const setLine = (i: number, p: Partial<RfqLineValue>) => set({ lines: v.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const project = projects.find((p) => p.id === v.projectId);
  const optMap = new Map(options.map((o) => [o.id, o]));
  const locs = locations.filter((l) => l.status === "ACTIVE" && (l.type === "WAREHOUSE" || (l.type === "SITE" && l.projectId === v.projectId)));

  async function save() {
    setBusy(true);
    const res = await callAction(createRfqAction, {
      ...v,
      validityDays: v.validityDays,
      lines: v.lines.map((l) => ({ itemId: l.itemBrandId ? optMap.get(l.itemBrandId)?.itemId : undefined, itemBrandId: l.itemBrandId, quantity: l.quantity, acceptableBrands: l.acceptableBrands, specifications: l.specifications, prLineId: l.prLineId })),
    });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setDirty(false);
    toast.success("Enquiry saved. Share it with the suppliers, then record their quotations.");
    router.push(`/rate-enquiries/${res.data.id}`);
  }

  return (
    <form className="space-y-4 pb-24" noValidate onSubmit={(e) => (e.preventDefault(), save())}>
      <FormSection title="Project" description="Every enquiry is for one project.">
        <Field id="rfq-project" label="Project" required error={errors.projectId}>
          {lockProject && project ? (
            <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {project.code} – {project.name}
            </p>
          ) : (
            <SingleSelect id="rfq-project" options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} value={v.projectId} onChange={(x) => set({ projectId: x, deliveryLocationId: siteOf(x) })} placeholder="Select project" allowClear={false} invalid={!!errors.projectId} />
          )}
          {prNumber && <p className="mt-1 text-xs text-muted-foreground">From requisition {prNumber}</p>}
        </Field>
        <Field id="rfq-location" label="Deliver to" error={errors.deliveryLocationId} help="Defaults to the project's site store.">
          <SingleSelect id="rfq-location" options={locs.map((l) => ({ value: l.id, label: l.name, hint: l.type === "SITE" ? "Site store" : "Warehouse" }))} value={v.deliveryLocationId} onChange={(x) => set({ deliveryLocationId: x })} placeholder={v.projectId ? "Project site store" : "Select the project first"} disabled={!v.projectId} />
        </Field>
      </FormSection>

      <FormSection title="Enquiry" description="Suppliers see the subject, dates and materials.">
        <Field id="rfq-title" label="Subject" required error={errors.title} className="sm:col-span-2">
          <Input id="rfq-title" placeholder="e.g. Cement and TMT bars for Block A slab" value={v.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!errors.title} />
        </Field>
        <Field id="rfq-due" label="Quotes needed by" error={errors.responseDue}>
          <Input id="rfq-due" type="date" value={v.responseDue} onChange={(e) => set({ responseDue: e.target.value })} />
        </Field>
        <Field id="rfq-required" label="Material needed at site by" error={errors.requiredBy}>
          <Input id="rfq-required" type="date" value={v.requiredBy} onChange={(e) => set({ requiredBy: e.target.value })} />
        </Field>
        <Field id="rfq-suppliers" label="Suppliers to ask" required error={errors.supplierIds} className="sm:col-span-2" help="Search and add as many as you like. Missing one?">
          <MultiSelect id="rfq-suppliers" options={suppliers.filter((s) => s.status === "ACTIVE").map((s) => ({ value: s.id, label: s.name, hint: s.gstin ?? "Unregistered" }))} value={v.supplierIds} onChange={(ids) => set({ supplierIds: ids })} placeholder="Search suppliers…" invalid={!!errors.supplierIds} />
          <Link href="/parties/new?type=supplier" className="mt-1 inline-block text-xs text-primary hover:underline">
            + Add a new supplier
          </Link>
        </Field>
      </FormSection>

      <section aria-labelledby="rfq-lines" className="space-y-2">
        <h2 id="rfq-lines" className="text-base font-semibold">
          Materials
        </h2>
        {v.lines.map((l, i) => {
          const opt = l.itemBrandId ? optMap.get(l.itemBrandId) : undefined;
          const err = (f: string) => errors[`lines.${i}.${f}`];
          return (
            <div key={l.key} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_8rem_auto]">
              <div className="space-y-1.5">
                <SingleSelect options={options.map((o) => ({ value: o.id, label: `${o.itemName} — ${o.brandName}`, hint: o.itemCode }))} value={l.itemBrandId} onChange={(x) => setLine(i, { itemBrandId: x })} allowClear={false} placeholder="Select item – preferred brand" searchPlaceholder="Search item, code or brand…" invalid={!!(err("itemBrandId") || err("itemId"))} />
                <Input aria-label={`Line ${i + 1} acceptable brands`} className="h-8 text-xs" placeholder={`Other acceptable brands (optional)${opt ? `, e.g. alternatives to ${opt.brandName}` : ""}`} value={l.acceptableBrands} onChange={(e) => setLine(i, { acceptableBrands: e.target.value })} />
                <Input aria-label={`Line ${i + 1} specification`} className="h-8 text-xs" placeholder="Specification / grade (optional)" value={l.specifications} onChange={(e) => setLine(i, { specifications: e.target.value })} />
                {(err("itemBrandId") || err("itemId")) && <p className="text-xs text-destructive">{err("itemBrandId") ?? "Select an item."}</p>}
              </div>
              <div>
                <Input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" className="text-right" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-invalid={!!err("quantity")} />
                {opt && <p className="mt-1 text-right text-xs text-muted-foreground">{opt.unit} · stock {formatQty(opt.currentQty)}</p>}
                {err("quantity") && <p className="mt-1 text-right text-xs text-destructive">{err("quantity")}</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} disabled={v.lines.length <= 1} onClick={() => set({ lines: v.lines.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
          );
        })}
        <Button type="button" size="sm" variant="outline" onClick={() => set({ lines: [...v.lines, emptyRfqLine()] })}>
          <Plus /> Add material
        </Button>
        {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
      </section>

      {!more ? (
        <Button type="button" variant="link" className="px-0" onClick={() => setMore(true)}>
          + Add terms (payment, freight, tax, validity, address)
        </Button>
      ) : (
        <FormSection title="Terms" description="Optional — printed on the enquiry.">
          <Field id="rfq-payment" label="Payment terms">
            <Input id="rfq-payment" placeholder="e.g. 30 days from receipt" value={v.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} />
          </Field>
          <Field id="rfq-freight" label="Freight terms">
            <Input id="rfq-freight" placeholder="e.g. Delivered to site" value={v.freightTerms} onChange={(e) => set({ freightTerms: e.target.value })} />
          </Field>
          <Field id="rfq-tax" label="Tax terms">
            <Input id="rfq-tax" placeholder="e.g. GST extra as applicable" value={v.taxTerms} onChange={(e) => set({ taxTerms: e.target.value })} />
          </Field>
          <Field id="rfq-validity" label="Quote valid for (days)" error={errors.validityDays}>
            <Input id="rfq-validity" type="number" min="1" max="365" value={v.validityDays} onChange={(e) => set({ validityDays: e.target.value })} />
          </Field>
          <Field id="rfq-address" label="Delivery address" className="sm:col-span-2">
            <Input id="rfq-address" value={v.deliveryAddress} onChange={(e) => set({ deliveryAddress: e.target.value })} />
          </Field>
          <Field id="rfq-spec" label="General specifications" className="sm:col-span-2">
            <Textarea id="rfq-spec" rows={2} value={v.specifications} onChange={(e) => set({ specifications: e.target.value })} />
          </Field>
        </FormSection>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Save enquiry
        </Button>
      </div>
    </form>
  );
}
