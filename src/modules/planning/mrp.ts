/**
 * Material Requirement Planning maths — pure and unit-tested. All inputs are decimal strings
 * computed by the database; nothing here trusts client-side numbers.
 *
 * Definitions (per project × item–brand):
 *   siteStock        on hand at the project's site store
 *   inTransit        dispatched to the site on challans, not yet received
 *   consumed         consumed / installed at the site (net of reversals)
 *   fulfilled        siteStock + inTransit + consumed
 *   remainingNeed    max(0, required − fulfilled)
 *   projectReserved  open reservations for this project (in stores)
 *   incoming         open quantity on approved POs for this project (ordered − accepted)
 *   poPipeline       quantity on draft / pending-approval POs for this project
 *   openPr           requisitioned but not yet ordered for this project
 *   shortage         max(0, remainingNeed − projectReserved − incoming)        (not covered by stock or approved orders)
 *   freeStock (ATP)  usable company stock not reserved for anyone (warehouses + sites, excl. transit / quarantine)
 *   toOrder          max(0, shortage − poPipeline − openPr − freeStock)         (avoids double ordering)
 *   canReserveNow    min(freeStock, max(0, shortage − poPipeline − openPr))
 */
import { qtyUnits, fmtQty } from "@/lib/money";

export type MrpInput = {
  required: string;
  siteStock: string;
  inTransit: string;
  consumed: string;
  projectReserved: string;
  incoming: string;
  poPipeline: string;
  openPr: string;
  freeStock: string;
  receivedAtSite: string;
  damagedRejected: string;
  expectedDate: Date | null;
  requiredBy: Date | null;
  usableCompany: string;
  reorderLevel: string | null;
  today: Date;
};

export type MrpStatus = "FULLY_RECEIVED" | "AVAILABLE" | "AWAITING_DELIVERY" | "PARTIALLY_RECEIVED" | "DELAYED" | "ALREADY_ORDERED" | "LOW_STOCK" | "SHORTAGE";

export type MrpResult = {
  fulfilled: string;
  remainingNeed: string;
  shortage: string;
  toOrder: string;
  canReserveNow: string;
  status: MrpStatus;
  flags: ("DAMAGED" | "BELOW_REORDER" | "DUE_SOON" | "OVERDUE")[];
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

const Z = BigInt(0);
const max0 = (v: bigint) => (v < Z ? Z : v);
const min = (a: bigint, b: bigint) => (a < b ? a : b);

export function computeMrp(i: MrpInput): MrpResult {
  const q = qtyUnits;
  const fulfilled = q(i.siteStock) + q(i.inTransit) + q(i.consumed);
  const remaining = max0(q(i.required) - fulfilled);
  const shortage = max0(remaining - q(i.projectReserved) - q(i.incoming));
  const afterRequests = max0(shortage - q(i.poPipeline) - q(i.openPr));
  const free = max0(q(i.freeStock));
  const toOrder = max0(afterRequests - free);
  const canReserve = min(free, afterRequests);

  const overdueDelivery = !!i.expectedDate && i.expectedDate.getTime() < i.today.getTime();
  let status: MrpStatus;
  if (remaining === Z) status = "FULLY_RECEIVED";
  else if (shortage === Z) {
    if (q(i.incoming) > Z) status = overdueDelivery ? "DELAYED" : q(i.receivedAtSite) > Z ? "PARTIALLY_RECEIVED" : "AWAITING_DELIVERY";
    else status = "AVAILABLE";
  } else if (afterRequests === Z) status = "ALREADY_ORDERED";
  else if (toOrder === Z) status = "AVAILABLE";
  else if (free > Z) status = "LOW_STOCK";
  else status = "SHORTAGE";

  const flags: MrpResult["flags"] = [];
  if (q(i.damagedRejected) > Z) flags.push("DAMAGED");
  if (i.reorderLevel !== null && q(i.usableCompany) <= q(i.reorderLevel)) flags.push("BELOW_REORDER");
  const days = i.requiredBy ? Math.floor((i.requiredBy.getTime() - i.today.getTime()) / 86_400_000) : null;
  if (days !== null && remaining > Z) {
    if (days < 0) flags.push("OVERDUE");
    else if (days <= 7) flags.push("DUE_SOON");
  }

  const urgency: MrpResult["urgency"] = shortage === Z ? "LOW" : days !== null && days < 0 ? "CRITICAL" : days !== null && days <= 7 ? "HIGH" : days !== null && days <= 21 ? "MEDIUM" : toOrder > Z ? "MEDIUM" : "LOW";

  return { fulfilled: fmtQty(fulfilled), remainingNeed: fmtQty(remaining), shortage: fmtQty(shortage), toOrder: fmtQty(toOrder), canReserveNow: fmtQty(canReserve), status, flags, urgency };
}
