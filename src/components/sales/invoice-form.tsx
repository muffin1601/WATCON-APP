"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field, FormSection } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/call-action";
import { formatQty } from "@/lib/format";
import { formatINR, lineAmounts } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createClientInvoiceAction } from "@/modules/sales/actions";

export type InvoiceSourceLine = { sourceLineId: string; label: string; unit: string | null; max: string; quantity: string; rate: string; discountPct: string; gstRate: string; fixed: boolean; note?: string };

function safeLine(l: InvoiceSourceLine, qty: string, mode: "INTRA" | "INTER") {
  try {
    if (!qty || Number(qty) <= 0) return null;
    return lineAmounts({ qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate }, mode);
  } catch {
    return null;
  }
}

export function InvoiceForm({ source, sourceId, lines, deductions, taxMode, defaultDue }: { source: "RA" | "SO" | "CPO"; sourceId: string; lines: InvoiceSourceLine[]; deductions: { retention: string; advance: string; other: string } | null; taxMode: "INTRA" | "INTER"; defaultDue: string }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.sourceLineId, l.quantity])));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(defaultDue);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  let taxable = 0;
  let tax = 0;
  for (const l of lines) {
    const a = safeLine(l, qty[l.sourceLineId] ?? "", taxMode);
    if (a) {
      taxable += Number(a.taxable);
      tax += Number(a.tax);
    }
  }
  const total = Math.round(taxable + tax);
  const ded = deductions ? Number(deductions.retention) + Number(deductions.advance) + Number(deductions.other) : 0;

  async function save() {
    setBusy(true);
    const res = await callAction(createClientInvoiceAction, { source, raBillId: source === "RA" ? sourceId : null, soId: source === "SO" ? sourceId : null, clientPoId: source === "CPO" ? sourceId : null, invoiceDate, dueDate, notes, lines: lines.map((l) => ({ sourceLineId: l.sourceLineId, quantity: qty[l.sourceLineId] || "0" })) });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success("Invoice drafted. Check it, then Issue to allocate the GST invoice number.");
    router.push(`/client-invoices/${res.data.id}`);
  }

  return (
    <form className="space-y-4 pb-24" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
      <FormSection title="Invoice">
        <Field id="inv-date" label="Invoice date" required error={errors.invoiceDate}><Input id="inv-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
        <Field id="inv-due" label="Due date" error={errors.dueDate} help="Blank = client's payment terms."><Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field id="inv-notes" label="Notes on invoice" error={errors.notes} className="sm:col-span-2"><Textarea id="inv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </FormSection>
      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Lines</h2>
          <p className="text-xs text-muted-foreground">{source === "RA" ? "Certified quantities from the running bill (fixed)." : source === "SO" ? "Delivered quantity not yet invoiced. Reduce a quantity to invoice part of it." : "Contract quantity not yet billed. Enter what you are invoicing now."}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-2 py-2 text-left font-medium">Description</th><th className="px-2 py-2 text-right font-medium">Available</th><th className="w-32 px-2 py-2 text-right font-medium">Invoice qty</th><th className="px-2 py-2 text-right font-medium">Rate</th><th className="px-2 py-2 text-right font-medium">GST</th><th className="px-2 py-2 text-right font-medium">Taxable</th></tr></thead>
            <tbody className="divide-y">
              {lines.map((l, i) => {
                const q = qty[l.sourceLineId] ?? "";
                const over = Number(q) > Number(l.max);
                const a = safeLine(l, q, taxMode);
                return (
                  <tr key={l.sourceLineId} className="align-top">
                    <td className="px-2 py-2"><div>{l.label}</div>{l.note && <div className="text-xs text-muted-foreground">{l.note}</div>}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatQty(l.max)} {l.unit ?? ""}</td>
                    <td className="px-2 py-2">
                      {l.fixed ? <p className="text-right tabular-nums">{formatQty(q)}</p> : <Input aria-label={`Invoice quantity for ${l.label}`} inputMode="decimal" className={cn("text-right", over && "border-rose-400")} value={q} disabled={Number(l.max) <= 0} onChange={(e) => setQty({ ...qty, [l.sourceLineId]: e.target.value })} />}
                      {(over || errors[`lines.${i}.quantity`]) && <p className="mt-1 text-right text-xs text-destructive">{errors[`lines.${i}.quantity`] ?? `Max ${formatQty(l.max)}`}</p>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">₹{Number(l.rate)}{Number(l.discountPct) ? ` −${Number(l.discountPct)}%` : ""}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{Number(l.gstRate)}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{a ? formatINR(a.taxable) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}
      </section>
      <div className="ml-auto max-w-sm space-y-1 rounded-xl border bg-card p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Taxable value</span><span className="tabular-nums">{formatINR(taxable.toFixed(2))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{taxMode === "INTRA" ? "CGST + SGST" : "IGST"}</span><span className="tabular-nums">{formatINR(tax.toFixed(2))}</span></div>
        <div className="flex justify-between border-t pt-1 font-semibold"><span>Invoice total (rounded)</span><span className="tabular-nums">{formatINR(total.toFixed(2))}</span></div>
        {deductions && ded > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground"><span>Less retention / advance / other</span><span className="tabular-nums">−{formatINR(ded.toFixed(2))}</span></div>
            <div className="flex justify-between font-semibold"><span>Net receivable</span><span className="tabular-nums">{formatINR((total - ded).toFixed(2))}</span></div>
          </>
        )}
        <p className="pt-1 text-xs text-muted-foreground">Preview only — the server recalculates and stores the final figures.</p>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={busy}>Create draft invoice</Button>
      </div>
    </form>
  );
}
