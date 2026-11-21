import { addQty, cmpQty, formatINR, subQty, type TaxMode } from "@/lib/money";

/**
 * Bill-to-PO/GRN matching, pure so the bill form can preview exactly what the server will
 * decide. The server re-runs it inside the approval transaction with locked counters.
 */

export type MatchMode = "TWO_WAY" | "THREE_WAY";

export type MatchException = { code: "QTY_OVER_RECEIVED" | "QTY_OVER_ORDERED" | "RATE_VARIANCE" | "NOT_ON_PO" | "GSTIN_MISMATCH" | "TAX_MODE_MISMATCH" | "PO_NOT_OPEN"; line?: number; message: string };

export type MatchLine = { lineNo: number; description: string; quantity: string; rate: string; poLineId?: string | null; grnLineId?: string | null };

/** Live counters for a PO line / GRN line (billed = already approved bills only). */
export type PoLineRef = { id: string; rate: string; quantity: string; acceptedQty: string; billedQty: string; unit?: string | null };
export type GrnLineRef = { id: string; poLineId: string | null; acceptedQty: string; billedQty: string; grnNumber?: string };

export type MatchInput = {
  mode: MatchMode;
  rateTolerancePct: string;
  billTaxMode: TaxMode;
  poTaxMode?: TaxMode | null;
  supplierGstin?: string | null;
  partyGstin?: string | null;
  hasPo: boolean;
  lines: MatchLine[];
  poLines: PoLineRef[];
  grnLines: GrnLineRef[];
};

const pos = (v: string) => (cmpQty(v, "0") > 0 ? v : "0");

/** Quantity still billable on a PO line / GRN line, given the mode. */
export function billableQty(mode: MatchMode, pl: PoLineRef, gl?: GrnLineRef | null): string {
  if (gl) return pos(subQty(gl.acceptedQty, gl.billedQty));
  return pos(subQty(mode === "THREE_WAY" ? pl.acceptedQty : pl.quantity, pl.billedQty));
}

export function matchBill(input: MatchInput): { status: "MATCHED" | "EXCEPTION" | "NOT_MATCHED"; exceptions: MatchException[] } {
  const ex: MatchException[] = [];
  const gstin = (v?: string | null) => (v ?? "").trim().toUpperCase();
  if (input.supplierGstin && input.partyGstin && gstin(input.supplierGstin) !== gstin(input.partyGstin)) {
    ex.push({ code: "GSTIN_MISMATCH", message: `The GSTIN on the invoice (${gstin(input.supplierGstin)}) is not the supplier's registered GSTIN (${gstin(input.partyGstin)}).` });
  }
  if (!input.hasPo) return { status: ex.length ? "EXCEPTION" : "NOT_MATCHED", exceptions: ex };
  if (input.poTaxMode && input.poTaxMode !== input.billTaxMode) {
    ex.push({ code: "TAX_MODE_MISMATCH", message: `The invoice charges ${input.billTaxMode === "INTER" ? "IGST" : "CGST + SGST"}, but the PO was raised with ${input.poTaxMode === "INTER" ? "IGST" : "CGST + SGST"}.` });
  }
  const poMap = new Map(input.poLines.map((p) => [p.id, p]));
  const grnMap = new Map(input.grnLines.map((g) => [g.id, g]));
  // The same PO / GRN line may appear on several bill lines: compare their combined quantity.
  const usePo = new Map<string, string>();
  const useGrn = new Map<string, string>();
  const tol = Number(input.rateTolerancePct || "0");
  for (const l of input.lines) {
    const pl = l.poLineId ? poMap.get(l.poLineId) : undefined;
    if (!pl) {
      ex.push({ code: "NOT_ON_PO", line: l.lineNo, message: `Line ${l.lineNo} (${l.description}) is not on the purchase order.` });
      continue;
    }
    const gl = l.grnLineId ? grnMap.get(l.grnLineId) : undefined;
    const rate = Number(pl.rate);
    if (rate > 0) {
      const variance = ((Number(l.rate) - rate) / rate) * 100;
      if (variance > tol + 1e-9) ex.push({ code: "RATE_VARIANCE", line: l.lineNo, message: `Line ${l.lineNo}: billed rate ${formatINR(l.rate)} is ${variance.toFixed(2)}% above the PO rate ${formatINR(pl.rate)}${tol ? ` (tolerance ${tol}%)` : ""}.` });
    } else if (Number(l.rate) > 0) {
      ex.push({ code: "RATE_VARIANCE", line: l.lineNo, message: `Line ${l.lineNo}: the PO rate is zero but the bill charges ${formatINR(l.rate)}.` });
    }
    if (gl) {
      const used = addTo(useGrn, gl.id, l.quantity);
      const avail = pos(subQty(gl.acceptedQty, gl.billedQty));
      if (cmpQty(used, avail) > 0) ex.push({ code: "QTY_OVER_RECEIVED", line: l.lineNo, message: `Line ${l.lineNo}: billed ${used} but only ${avail} accepted on ${gl.grnNumber ?? "the site receipt"} is still unbilled.` });
    }
    const usedPo = addTo(usePo, pl.id, l.quantity);
    const availPo = billableQty(input.mode, pl);
    if (cmpQty(usedPo, availPo) > 0) {
      if (input.mode === "THREE_WAY") {
        if (!gl) ex.push({ code: "QTY_OVER_RECEIVED", line: l.lineNo, message: `Line ${l.lineNo}: billed ${usedPo} but only ${availPo} received and accepted is still unbilled.` });
      } else {
        ex.push({ code: "QTY_OVER_ORDERED", line: l.lineNo, message: `Line ${l.lineNo}: billed ${usedPo} but only ${availPo} ordered is still unbilled.` });
      }
    }
  }
  return { status: ex.length ? "EXCEPTION" : "MATCHED", exceptions: ex };
}

function addTo(m: Map<string, string>, k: string, q: string) {
  const prev = m.get(k) ?? "0";
  const next = addQty(prev, q);
  m.set(k, next);
  return next;
}

/** Normalised duplicate-detection key for a supplier invoice number. */
export function invoiceKeyOf(no: string) {
  return no.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
