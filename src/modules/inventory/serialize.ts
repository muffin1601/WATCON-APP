import type { LedgerRow } from "@/components/inventory/tables";
import { sourceLink } from "@/modules/documents/links";
import type { findLedger } from "./repository";

type LedgerResult = Awaited<ReturnType<typeof findLedger>>["rows"][number];

export function toLedgerRow(r: LedgerResult): LedgerRow {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    direction: r.direction,
    quantity: r.quantity,
    balanceAfter: r.balanceAfter,
    txnDate: r.txnDate.toISOString(),
    reference: r.reference,
    remarks: r.remarks,
    reason: r.reason,
    item: r.item,
    brand: r.brand,
    location: r.location,
    project: r.project,
    source: r.sourceType && r.sourceId ? sourceLink(r.sourceType, r.sourceId) : null,
    createdBy: r.createdBy.fullName,
    reversible: !r.reversedBy && r.type !== "REVERSAL" && (!r.sourceType || r.sourceType === "manual" || r.sourceType === "project"),
  };
}

/** Today's business date as YYYY-MM-DD (form defaults / max). */
export function todayString(): string {
  const tz = process.env.APP_TIMEZONE || "Asia/Kolkata";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
