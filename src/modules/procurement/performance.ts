import "server-only";
import { db } from "@/lib/db";

export type SupplierPerf = { partyId: string; receipts: number; onTime: number; onTimePct: number | null; received: string; rejected: string; rejectionPct: number | null; poCount: number; poValue: string };

/**
 * Supplier reliability from posted GRNs against their POs:
 *   on-time %   = receipts dated on/before the PO's expected date ÷ receipts with an expected date
 *   rejection % = (damaged + rejected) ÷ received quantity
 */
export async function supplierPerformance(organizationId: string, partyIds?: string[]): Promise<Map<string, SupplierPerf>> {
  if (partyIds && !partyIds.length) return new Map();
  const ids = partyIds ? [...new Set(partyIds)] : null;
  const rows = await db.$queryRaw<{ party_id: string; receipts: number; dated: number; on_time: number; received: string; rejected: string; po_count: number; po_value: string }[]>`
    WITH g AS (
      SELECT po.party_id, g.id, g.receipt_date, po.expected_date
      FROM grns g JOIN purchase_orders po ON po.id = g.po_id
      WHERE g.organization_id = ${organizationId}::uuid AND g.status = 'POSTED' AND (${ids}::uuid[] IS NULL OR po.party_id = ANY(${ids}::uuid[]))
    ), q AS (
      SELECT po.party_id, SUM(gl.received_qty) AS received, SUM(gl.damaged_qty + gl.rejected_qty) AS rejected
      FROM grn_lines gl JOIN grns g ON g.id = gl.grn_id JOIN purchase_orders po ON po.id = g.po_id
      WHERE g.organization_id = ${organizationId}::uuid AND g.status = 'POSTED' AND (${ids}::uuid[] IS NULL OR po.party_id = ANY(${ids}::uuid[]))
      GROUP BY po.party_id
    ), p AS (
      SELECT party_id, COUNT(*)::int AS po_count, SUM(total) AS po_value FROM purchase_orders
      WHERE organization_id = ${organizationId}::uuid AND status NOT IN ('DRAFT','REJECTED','CANCELLED') AND (${ids}::uuid[] IS NULL OR party_id = ANY(${ids}::uuid[]))
      GROUP BY party_id
    )
    SELECT p.party_id::text, COALESCE(gs.receipts, 0)::int AS receipts, COALESCE(gs.dated, 0)::int AS dated, COALESCE(gs.on_time, 0)::int AS on_time,
      COALESCE(q.received, 0)::text AS received, COALESCE(q.rejected, 0)::text AS rejected, p.po_count, COALESCE(p.po_value, 0)::text AS po_value
    FROM p
    LEFT JOIN (SELECT party_id, COUNT(*) AS receipts, COUNT(expected_date) AS dated, COUNT(*) FILTER (WHERE expected_date IS NOT NULL AND receipt_date <= expected_date) AS on_time FROM g GROUP BY party_id) gs ON gs.party_id = p.party_id
    LEFT JOIN q ON q.party_id = p.party_id`;
  return new Map(
    rows.map((r) => {
      const received = Number(r.received);
      return [
        r.party_id,
        {
          partyId: r.party_id,
          receipts: r.receipts,
          onTime: r.on_time,
          onTimePct: r.dated ? Math.round((r.on_time / r.dated) * 1000) / 10 : null,
          received: r.received,
          rejected: r.rejected,
          rejectionPct: received > 0 ? Math.round((Number(r.rejected) / received) * 1000) / 10 : null,
          poCount: r.po_count,
          poValue: Number(r.po_value).toFixed(2),
        },
      ];
    }),
  );
}
