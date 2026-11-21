/**
 * Stock rules — pure functions, unit tested.
 *
 *  S1  Every movement has a positive quantity; its direction gives the sign
 *      (OPENING / INWARD → IN, OUTWARD → OUT, ADJUSTMENT → chosen direction).
 *  S2  Stock can never go below zero (no approved business rule permits it).
 *  S3  A movement cannot be dated in the future, nor earlier than the latest movement
 *      already posted for the same item–brand AT THE SAME LOCATION, so each location's
 *      running balance stays in date order. Documents post on their posting date.
 *  S5  Balances are kept per item–brand–location; item_brands.current_qty is their sum.
 *  S6  An OUT movement may not consume stock reserved for a different project
 *      (except physical corrections: adjustments, write-offs, reversals).
 *  S4  Period summary: opening = everything before `from` plus OPENING entries;
 *      inward / outward = non-opening movements inside the period;
 *      closing = opening + inward − outward.
 */

export type StockTxnType = "OPENING" | "INWARD" | "OUTWARD" | "ADJUSTMENT" | "RECEIPT" | "TRANSFER_OUT" | "TRANSFER_IN" | "RETURN_TO_SUPPLIER" | "CLIENT_DELIVERY" | "CONSUMPTION" | "WRITE_OFF" | "REVERSAL";
export type StockDirection = "IN" | "OUT";

export const STOCK_TXN_LABELS: Record<StockTxnType, string> = {
  OPENING: "Opening",
  INWARD: "Inward",
  OUTWARD: "Outward",
  ADJUSTMENT: "Adjustment",
  RECEIPT: "GRN receipt",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  RETURN_TO_SUPPLIER: "Return to supplier",
  CLIENT_DELIVERY: "Client delivery",
  CONSUMPTION: "Consumption",
  WRITE_OFF: "Write-off",
  REVERSAL: "Reversal",
};

/** Movement types whose OUT leg may use stock reserved for another project (physical corrections). */
export const RESERVATION_EXEMPT_TYPES: readonly StockTxnType[] = ["ADJUSTMENT", "WRITE_OFF", "REVERSAL"];

export function directionFor(type: StockTxnType, adjustmentDirection?: StockDirection | null): StockDirection {
  if (type === "OPENING" || type === "INWARD" || type === "RECEIPT" || type === "TRANSFER_IN") return "IN";
  if (type === "OUTWARD" || type === "TRANSFER_OUT" || type === "RETURN_TO_SUPPLIER" || type === "CLIENT_DELIVERY" || type === "CONSUMPTION" || type === "WRITE_OFF") return "OUT";
  if (!adjustmentDirection) throw new Error("Adjustment direction is required");
  return adjustmentDirection;
}

const SCALE = BigInt(1000);
const ZERO = BigInt(0);

/** "12.5" → 12500n (thousandths). Exact for the 3-decimal quantities the ledger stores. */
export function toMilli(value: string | number): bigint {
  const s = String(value).trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) throw new Error(`Invalid quantity: ${s}`);
  const whole = BigInt(m[2]!) * SCALE + BigInt((m[3] ?? "").padEnd(3, "0") || "0");
  return m[1] === "-" ? -whole : whole;
}

/** 12500n → "12.5" */
export function fromMilli(value: bigint): string {
  const neg = value < ZERO;
  const abs = neg ? -value : value;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(3, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Balance after applying a movement, or null when it would go negative (S2). */
export function applyMovement(balance: string, direction: StockDirection, qty: string): string | null {
  const next = toMilli(balance) + (direction === "IN" ? toMilli(qty) : -toMilli(qty));
  return next < ZERO ? null : fromMilli(next);
}

/** S3. Dates are UTC-midnight calendar dates. Returns an error message or null. */
export function movementDateError(txnDate: Date, today: Date, latest: Date | null): string | null {
  if (txnDate.getTime() > today.getTime()) return "Stock cannot be posted with a future date.";
  if (latest && txnDate.getTime() < latest.getTime()) return "This item–brand already has a later movement. Post with that date or later so the running balance stays in date order.";
  return null;
}

export type LedgerEntry = { type: StockTxnType; direction: StockDirection; quantity: string; txnDate: Date };
export type StockSummary = { opening: string; inward: string; outward: string; closing: string };

/** S4 — reference implementation (the database computes the same thing in SQL). */
export function summarize(entries: LedgerEntry[], from: Date | null, to: Date | null): StockSummary {
  let opening = ZERO;
  let inward = ZERO;
  let outward = ZERO;
  for (const e of entries) {
    if (to && e.txnDate.getTime() > to.getTime()) continue;
    const q = toMilli(e.quantity);
    const signed = e.direction === "IN" ? q : -q;
    if (e.type === "OPENING" || (from && e.txnDate.getTime() < from.getTime())) opening += signed;
    else if (e.direction === "IN") inward += q;
    else outward += q;
  }
  return { opening: fromMilli(opening), inward: fromMilli(inward), outward: fromMilli(outward), closing: fromMilli(opening + inward - outward) };
}
