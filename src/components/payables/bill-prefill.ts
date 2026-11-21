import type { EditableLine } from "@/components/commercial/lines-editor";
import { newId } from "@/lib/utils";
import type { MatchRefs } from "./bill-form";

/**
 * Pure helpers that turn a PO bill prefill into form state. Kept out of the "use client"
 * bill-form module so the server page can call them too (a server component cannot invoke
 * functions exported from a client module).
 */
type Prefill = Awaited<ReturnType<typeof import("@/modules/payables/bills").billPrefillFromPo>>;

export function linesFromPrefill(p: Prefill): EditableLine[] {
  return p.lines.map((l) => ({ key: newId(), description: l.description, hsnSac: l.hsnCode ?? "", unit: l.unit, quantity: l.quantity, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate, note: l.note, links: { poLineId: l.poLineId, grnLineId: l.grnLineId, itemBrandId: l.itemBrandId } }));
}

export function refsFromPrefill(p: Prefill): MatchRefs {
  return { poNumber: p.po.number, poTaxMode: p.po.taxMode, mode: p.mode, rateTolerancePct: p.rateTolerancePct, poLines: p.poLines, grnLines: p.grnLines };
}
