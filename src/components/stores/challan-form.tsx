"use client";

import { ArrowLeftRight, Building2, Loader2, Plus, Save, Trash2, Truck, Undo2, UserRound, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ItemBrandOpt } from "@/components/commercial/lines-editor";
import { SingleSelect } from "@/components/forms/combobox";
import { Field, FormSection } from "@/components/forms/field";
import type { LocOpt, PartyOpt, ProjectOpt } from "@/components/procurement/po-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { callAction } from "@/lib/call-action";
import { formatQty } from "@/lib/format";
import { cmpQty } from "@/lib/money";
import { cn, newId } from "@/lib/utils";
import { createChallanAction } from "@/modules/stores/actions";

export type ChallanType = "ISSUE_TO_SITE" | "SITE_TO_SITE" | "RETURN_TO_STORE" | "RETURN_TO_SUPPLIER" | "CLIENT_DELIVERY";

const TYPES: { key: ChallanType; title: string; help: string; icon: typeof Truck }[] = [
  { key: "ISSUE_TO_SITE", title: "Send from store to site", help: "Material leaves the central store for this project's site.", icon: Warehouse },
  { key: "SITE_TO_SITE", title: "Bring from another site", help: "Transfer surplus material from another site to this project.", icon: ArrowLeftRight },
  { key: "RETURN_TO_STORE", title: "Return site material to store", help: "Unused material goes back from this site to the store.", icon: Undo2 },
  { key: "RETURN_TO_SUPPLIER", title: "Return to supplier", help: "Send rejected or excess material back to the supplier.", icon: Building2 },
  { key: "CLIENT_DELIVERY", title: "Deliver to client", help: "Supply material to the client against the project's sales order.", icon: UserRound },
];

export type ChallanFormData = {
  stock: { itemBrandId: string; locationId: string; onHand: string }[];
  pos: { id: string; number: string; partyId: string; projectId: string | null }[];
  sos: { id: string; number: string; partyId: string; projectId: string; lines: { itemBrandId: string; pending: string }[] }[];
};

type Line = { key: string; itemBrandId: string | null; quantity: string; remarks: string };

export function ChallanForm({ initial, lockProject, projects, locations, options, suppliers, clients, data, today }: { initial: { type: ChallanType; projectId: string | null; itemBrandId: string | null; qty: string; soId: string | null }; lockProject: boolean; projects: ProjectOpt[]; locations: LocOpt[]; options: ItemBrandOpt[]; suppliers: PartyOpt[]; clients: PartyOpt[]; data: ChallanFormData; today: string }) {
  const router = useRouter();
  const [type, setType] = useState<ChallanType>(initial.type);
  const [projectId, setProjectId] = useState<string | null>(initial.projectId);
  const siteOf = (pid: string | null) => locations.find((l) => l.type === "SITE" && l.projectId === pid && l.status === "ACTIVE")?.id ?? null;
  const warehouses = locations.filter((l) => l.type === "WAREHOUSE" && l.status === "ACTIVE");
  const [fromLocationId, setFrom] = useState<string | null>(() => defaultFrom(initial.type, initial.projectId));
  const [toLocationId, setTo] = useState<string | null>(initial.type === "RETURN_TO_STORE" ? (warehouses[0]?.id ?? null) : null);
  const [partyId, setParty] = useState<string | null>(null);
  const [poId, setPo] = useState<string | null>(null);
  const [soId, setSo] = useState<string | null>(initial.soId);
  const [head, setHead] = useState({ dispatchDate: today, expectedDate: "", vehicleNo: "", transporter: "", lrNumber: "", driverName: "", driverPhone: "", senderName: "", receiverName: "", remarks: "" });
  const [lines, setLines] = useState<Line[]>(() => (initial.itemBrandId ? [{ key: newId(), itemBrandId: initial.itemBrandId, quantity: initial.qty, remarks: "" }] : initial.soId ? soLines(initial.soId) : [{ key: newId(), itemBrandId: null, quantity: "", remarks: "" }]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty && !busy);
  const touch = () => setDirty(true);

  function defaultFrom(t: ChallanType, pid: string | null) {
    if (t === "ISSUE_TO_SITE") return warehouses[0]?.id ?? null;
    if (t === "SITE_TO_SITE") return null;
    return siteOf(pid) ?? (t === "RETURN_TO_STORE" ? null : (warehouses[0]?.id ?? null));
  }
  function soLines(id: string): Line[] {
    const so = data.sos.find((s) => s.id === id);
    const open = so?.lines.filter((l) => cmpQty(l.pending, "0") > 0) ?? [];
    return open.length ? open.map((l) => ({ key: newId(), itemBrandId: l.itemBrandId, quantity: l.pending, remarks: "" })) : [{ key: newId(), itemBrandId: null, quantity: "", remarks: "" }];
  }

  const stockAt = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of data.stock) if (s.locationId === fromLocationId) m.set(s.itemBrandId, s.onHand);
    return m;
  }, [data.stock, fromLocationId]);
  const project = projects.find((p) => p.id === projectId);
  const projectSos = data.sos.filter((s) => s.projectId === projectId);
  const so = data.sos.find((s) => s.id === soId);
  const soPending = new Map(so?.lines.map((l) => [l.itemBrandId, l.pending]) ?? []);
  const itemChoices = (type === "CLIENT_DELIVERY" && so ? options.filter((o) => soPending.has(o.id)) : options).map((o) => ({ value: o.id, label: `${o.itemName} — ${o.brandName}`, hint: `${stockAt.has(o.id) ? `${formatQty(stockAt.get(o.id))} ${o.unit} here` : "none at source"}${soPending.has(o.id) ? ` · ${formatQty(soPending.get(o.id))} to deliver` : ""}` }));

  const fromChoices = (() => {
    const sites = locations.filter((l) => l.type === "SITE" && l.status === "ACTIVE");
    if (type === "ISSUE_TO_SITE") return warehouses;
    if (type === "SITE_TO_SITE") return sites.filter((l) => l.projectId !== projectId);
    if (type === "RETURN_TO_STORE") return sites.filter((l) => l.projectId === projectId);
    return [...sites.filter((l) => l.projectId === projectId), ...warehouses];
  })();

  function changeType(t: ChallanType) {
    touch();
    setType(t);
    setFrom(defaultFrom(t, projectId));
    setTo(t === "RETURN_TO_STORE" ? (warehouses[0]?.id ?? null) : null);
    setParty(null);
    setPo(null);
    setSo(null);
    setErrors({});
  }
  function changeProject(pid: string | null) {
    touch();
    setProjectId(pid);
    setFrom(defaultFrom(type, pid));
    setPo(null);
    setSo(null);
  }

  async function save() {
    setBusy(true);
    const payload = {
      type,
      projectId,
      fromLocationId,
      toLocationId: type === "RETURN_TO_STORE" ? toLocationId : null,
      partyId: type === "CLIENT_DELIVERY" ? (so?.partyId ?? null) : type === "RETURN_TO_SUPPLIER" ? partyId : null,
      poId: type === "RETURN_TO_SUPPLIER" ? poId : null,
      soId: type === "CLIENT_DELIVERY" ? soId : null,
      ...head,
      lines: lines.map((l) => ({ itemBrandId: l.itemBrandId, quantity: l.quantity, remarks: l.remarks })),
    };
    const res = await callAction(createChallanAction, payload);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setDirty(false);
    toast.success("Challan saved as draft. Dispatch it when the vehicle leaves.");
    router.push(`/challans/${res.data.id}`);
  }

  const setH = (p: Partial<typeof head>) => {
    touch();
    setHead((s) => ({ ...s, ...p }));
  };
  const setLine = (i: number, p: Partial<Line>) => {
    touch();
    setLines((s) => s.map((l, j) => (j === i ? { ...l, ...p } : l)));
  };

  return (
    <form className="space-y-4 pb-28" noValidate onSubmit={(e) => (e.preventDefault(), save())}>
      <FormSection title="Project" description="Every challan belongs to one project.">
        <Field id="ch-project" label="Project" required error={errors.projectId} className="sm:col-span-2">
          {lockProject && project ? (
            <p className="flex h-11 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {project.code} – {project.name}
            </p>
          ) : (
            <SingleSelect id="ch-project" options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))} value={projectId} onChange={changeProject} placeholder="Select project" allowClear={false} invalid={!!errors.projectId} />
          )}
        </Field>
      </FormSection>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-base font-semibold">What are you doing?</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const on = t.key === type;
            return (
              <label key={t.key} className={cn("flex cursor-pointer gap-3 rounded-xl border bg-card p-3 transition-colors", on ? "border-primary ring-2 ring-primary/30" : "hover:bg-accent")}>
                <input type="radio" name="challan-type" className="sr-only" checked={on} onChange={() => changeType(t.key)} />
                <Icon className={cn("mt-0.5 size-5 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">{t.help}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <FormSection title="Route">
        {type === "CLIENT_DELIVERY" && (
          <Field id="ch-so" label="Sales order" required error={errors.soId} help={projectId && !projectSos.length ? "This project has no approved sales order with material to deliver." : "Lines are filled with the quantity still to deliver."} className="sm:col-span-2">
            <SingleSelect
              id="ch-so"
              options={projectSos.map((s) => ({ value: s.id, label: s.number, hint: clients.find((c) => c.id === s.partyId)?.name }))}
              value={soId}
              disabled={!projectId}
              onChange={(v) => {
                touch();
                setSo(v);
                if (v) setLines(soLines(v));
              }}
              placeholder={projectId ? "Select the approved sales order" : "Select the project first"}
              invalid={!!errors.soId}
            />
          </Field>
        )}
        {type === "RETURN_TO_SUPPLIER" && (
          <>
            <Field id="ch-supplier" label="Supplier" required error={errors.partyId}>
              <SingleSelect id="ch-supplier" options={suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.gstin ?? undefined }))} value={partyId} onChange={(v) => (touch(), setParty(v), setPo(null))} placeholder="Select supplier" invalid={!!errors.partyId} />
            </Field>
            <Field id="ch-po" label="Against purchase order" help="Optional — links the return to the PO so it is not billed." error={errors.poId}>
              <SingleSelect id="ch-po" options={data.pos.filter((p) => p.partyId === partyId && p.projectId === projectId).map((p) => ({ value: p.id, label: p.number }))} value={poId} onChange={(v) => (touch(), setPo(v))} disabled={!partyId} placeholder={partyId ? "Select PO" : "Select the supplier first"} />
            </Field>
          </>
        )}
        <Field id="ch-from" label={type === "SITE_TO_SITE" ? "From which site" : "Dispatch from"} required error={errors.fromLocationId}>
          <SingleSelect id="ch-from" options={fromChoices.map((l) => ({ value: l.id, label: l.name, hint: l.type === "SITE" ? "Site store" : "Warehouse" }))} value={fromLocationId} onChange={(v) => (touch(), setFrom(v))} placeholder={fromChoices.length ? "Select location" : "No stock location available"} invalid={!!errors.fromLocationId} />
        </Field>
        {type === "RETURN_TO_STORE" ? (
          <Field id="ch-to" label="To warehouse" required error={errors.toLocationId}>
            <SingleSelect id="ch-to" options={warehouses.map((l) => ({ value: l.id, label: l.name }))} value={toLocationId} onChange={(v) => (touch(), setTo(v))} placeholder="Select warehouse" />
          </Field>
        ) : type === "ISSUE_TO_SITE" || type === "SITE_TO_SITE" ? (
          <Field id="ch-to-site" label="Deliver to">
            <p className="flex h-9 items-center text-sm">{project ? `${project.name} site store` : "Select the project"}</p>
          </Field>
        ) : null}
        <Field id="ch-date" label="Dispatch date" required error={errors.dispatchDate}>
          <Input id="ch-date" type="date" className="h-11" value={head.dispatchDate} onChange={(e) => setH({ dispatchDate: e.target.value })} />
        </Field>
        <Field id="ch-exp" label="Expected arrival">
          <Input id="ch-exp" type="date" className="h-11" value={head.expectedDate} onChange={(e) => setH({ expectedDate: e.target.value })} />
        </Field>
      </FormSection>

      <section aria-labelledby="ch-lines" className="space-y-2">
        <h2 id="ch-lines" className="text-base font-semibold">
          Material
        </h2>
        {lines.map((l, i) => {
          const opt = options.find((o) => o.id === l.itemBrandId);
          const avail = l.itemBrandId ? (stockAt.get(l.itemBrandId) ?? "0") : null;
          const short = avail !== null && /^\d+(\.\d+)?$/.test(l.quantity) && cmpQty(l.quantity, avail) > 0;
          const err = (f: string) => errors[`lines.${i}.${f}`];
          return (
            <div key={l.key} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-start">
              <div>
                <SingleSelect options={itemChoices} value={l.itemBrandId} onChange={(v) => setLine(i, { itemBrandId: v })} allowClear={false} placeholder="Select item – brand" searchPlaceholder="Search item or brand…" invalid={!!err("itemBrandId")} />
                <Input aria-label={`Line ${i + 1} remarks`} className="mt-1 h-8 text-xs" placeholder="Remarks (optional)" value={l.remarks} onChange={(e) => setLine(i, { remarks: e.target.value })} />
                {err("itemBrandId") && <p className="mt-1 text-xs text-destructive">{err("itemBrandId")}</p>}
              </div>
              <div>
                <Input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" className="h-11 text-right text-base" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-invalid={!!err("quantity")} />
                {avail !== null && (
                  <p className={cn("mt-1 text-right text-xs", short ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {short ? "Only " : ""}
                    {formatQty(avail)} {opt?.unit} at source
                  </p>
                )}
                {err("quantity") && <p className="mt-1 text-right text-xs text-destructive">{err("quantity")}</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 1} onClick={() => (touch(), setLines((s) => s.filter((_, j) => j !== i)))}>
                <Trash2 />
              </Button>
            </div>
          );
        })}
        <Button type="button" size="sm" variant="outline" onClick={() => (touch(), setLines((s) => [...s, { key: newId(), itemBrandId: null, quantity: "", remarks: "" }]))}>
          <Plus /> Add material
        </Button>
        {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
      </section>

      <FormSection title="Transport" description="Printed on the challan.">
        <Field id="ch-vehicle" label="Vehicle no.">
          <Input id="ch-vehicle" className="h-11 uppercase" value={head.vehicleNo} onChange={(e) => setH({ vehicleNo: e.target.value })} />
        </Field>
        <Field id="ch-transporter" label="Transporter">
          <Input id="ch-transporter" className="h-11" value={head.transporter} onChange={(e) => setH({ transporter: e.target.value })} />
        </Field>
        <Field id="ch-lr" label="LR / docket no.">
          <Input id="ch-lr" className="h-11" value={head.lrNumber} onChange={(e) => setH({ lrNumber: e.target.value })} />
        </Field>
        <Field id="ch-driver" label="Driver name">
          <Input id="ch-driver" className="h-11" value={head.driverName} onChange={(e) => setH({ driverName: e.target.value })} />
        </Field>
        <Field id="ch-phone" label="Driver phone">
          <Input id="ch-phone" type="tel" inputMode="tel" className="h-11" value={head.driverPhone} onChange={(e) => setH({ driverPhone: e.target.value })} />
        </Field>
        <Field id="ch-sender" label="Sent by">
          <Input id="ch-sender" className="h-11" value={head.senderName} onChange={(e) => setH({ senderName: e.target.value })} />
        </Field>
        <Field id="ch-remarks" label="Remarks" className="sm:col-span-2">
          <Textarea id="ch-remarks" rows={2} value={head.remarks} onChange={(e) => setH({ remarks: e.target.value })} />
        </Field>
      </FormSection>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-background/95 p-3 backdrop-blur sm:sticky sm:justify-end sm:rounded-xl sm:border">
        <Button type="button" variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 flex-1 sm:flex-none" disabled={busy || !projectId}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Save challan
        </Button>
      </div>
    </form>
  );
}
