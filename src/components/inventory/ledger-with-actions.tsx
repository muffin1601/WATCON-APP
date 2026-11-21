"use client";

import { LedgerTable, type LedgerRow } from "./tables";
import { ReverseEntryButton } from "./location-ui";

/** Ledger with the reversal action for manual entries (document postings are reversed via their document). */
export function LedgerWithActions({ rows, canReverse, showItem = true }: { rows: (LedgerRow & { reversible?: boolean })[]; canReverse: boolean; showItem?: boolean }) {
  return <LedgerTable rows={rows} showItem={showItem} action={canReverse ? (r) => (r.reversible ? <ReverseEntryButton id={r.id} code={r.code} /> : null) : undefined} />;
}
