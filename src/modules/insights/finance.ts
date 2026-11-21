import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { addMoney, cmpMoney, percent, subMoney } from "@/lib/money";
import { dec2 } from "@/modules/commercial/core";

/**
 * Project financial position, aggregated in PostgreSQL from the operational documents.
 * Definitions are deliberately simple and are shown to users next to every figure
 * (see KPI_HELP). This is an operational sub-ledger, not a general ledger.
 */
export type ProjectFinancials = {
  contractValue: string;
  billed: string;
  billedTaxable: string;
  certified: string;
  received: string;
  receivable: string;
  committed: string;
  receivedValue: string;
  supplierBilled: string;
  supplierBilledTaxable: string;
  paid: string;
  payable: string;
  materialCost: string;
  margin: string;
  marginPct: string | null;
};

export const KPI_HELP = {
  contractValue: "Total value (incl. GST) of active, completed or closed client purchase orders, after revisions.",
  billed: "Issued client tax invoices (incl. GST), excluding drafts and cancelled invoices.",
  certified: "Gross value certified by the client on running bills.",
  received: "Client receipts recorded against this project (cash/bank + TDS deducted by the client).",
  receivable: "Issued invoices' net receivable (after retention, advance recovery and deductions) minus amounts received and credit notes.",
  committed: "Purchase orders approved or later (incl. GST), excluding drafts, rejected and cancelled orders.",
  receivedValue: "Material accepted at site on posted receipts, valued at the PO rate (excl. GST).",
  supplierBilled: "Approved supplier bills (incl. GST).",
  paid: "Supplier payments recorded against this project.",
  payable: "Approved supplier bills' net payable (after TDS) minus payments and supplier notes.",
  materialCost: "The higher of material received (at PO rate) and supplier bills approved, both excluding GST.",
  margin: "Billed revenue excluding GST minus material cost. Labour and overheads are not included.",
} as const;

const ZERO = "0.00";
const CONTRACT_ACTIVE = ["ACTIVE", "COMPLETED", "CLOSED"] as const;
const INVOICE_LIVE = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;
const RA_CERTIFIED = ["CLIENT_CERTIFIED", "INVOICED", "PARTIALLY_PAID", "PAID"] as const;
const PO_COMMITTED = ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"] as const;
const BILL_APPROVED = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;

export function emptyFinancials(): ProjectFinancials {
  return { contractValue: ZERO, billed: ZERO, billedTaxable: ZERO, certified: ZERO, received: ZERO, receivable: ZERO, committed: ZERO, receivedValue: ZERO, supplierBilled: ZERO, supplierBilledTaxable: ZERO, paid: ZERO, payable: ZERO, materialCost: ZERO, margin: ZERO, marginPct: null };
}

/** Financials for each of the given projects (callers pass only projects the actor may see). */
export async function projectFinancials(organizationId: string, projectIds: string[]): Promise<Map<string, ProjectFinancials>> {
  const out = new Map<string, ProjectFinancials>(projectIds.map((id) => [id, emptyFinancials()]));
  if (!projectIds.length) return out;
  const inProjects = { organizationId, projectId: { in: projectIds } };

  const [cpo, inv, ra, payIn, po, bills, payOut, received] = await Promise.all([
    db.clientPo.groupBy({ by: ["projectId"], where: { ...inProjects, status: { in: [...CONTRACT_ACTIVE] } }, _sum: { total: true } }),
    db.clientInvoice.groupBy({ by: ["projectId"], where: { ...inProjects, status: { in: [...INVOICE_LIVE] } }, _sum: { total: true, taxable: true, netReceivable: true, receivedAmount: true, adjustedAmount: true } }),
    db.raBill.groupBy({ by: ["projectId"], where: { ...inProjects, status: { in: [...RA_CERTIFIED] } }, _sum: { certifiedAmount: true } }),
    db.payment.groupBy({ by: ["projectId"], where: { ...inProjects, direction: "IN", status: "POSTED" }, _sum: { amount: true, tdsAmount: true } }),
    db.purchaseOrder.groupBy({ by: ["projectId"], where: { ...inProjects, status: { in: [...PO_COMMITTED] } }, _sum: { total: true } }),
    db.supplierBill.groupBy({ by: ["projectId"], where: { ...inProjects, status: { in: [...BILL_APPROVED] } }, _sum: { total: true, taxable: true, netPayable: true, paidAmount: true, adjustedAmount: true } }),
    db.payment.groupBy({ by: ["projectId"], where: { ...inProjects, direction: "OUT", status: "POSTED" }, _sum: { amount: true } }),
    db.$queryRaw<{ project_id: string; value: string }[]>`
      SELECT g.project_id::text AS project_id,
             ROUND(SUM(gl.accepted_qty * COALESCE(gl.unit_cost, pl.rate * (1 - pl.discount_pct / 100), 0)), 2)::text AS value
      FROM grn_lines gl
      JOIN grns g ON g.id = gl.grn_id
      LEFT JOIN po_lines pl ON pl.id = gl.po_line_id
      WHERE g.organization_id = ${organizationId}::uuid AND g.status = 'POSTED' AND g.po_id IS NOT NULL
        AND g.project_id = ANY(${projectIds}::uuid[])
      GROUP BY g.project_id`,
  ]);

  const get = (id: string | null) => (id ? out.get(id) : undefined);
  for (const r of cpo) { const f = get(r.projectId); if (f) f.contractValue = dec2(r._sum.total); }
  for (const r of inv) {
    const f = get(r.projectId);
    if (!f) continue;
    f.billed = dec2(r._sum.total);
    f.billedTaxable = dec2(r._sum.taxable);
    f.receivable = subMoney(dec2(r._sum.netReceivable), addMoney(dec2(r._sum.receivedAmount), dec2(r._sum.adjustedAmount)));
  }
  for (const r of ra) { const f = get(r.projectId); if (f) f.certified = dec2(r._sum.certifiedAmount); }
  for (const r of payIn) { const f = get(r.projectId); if (f) f.received = addMoney(dec2(r._sum.amount), dec2(r._sum.tdsAmount)); }
  for (const r of po) { const f = get(r.projectId); if (f) f.committed = dec2(r._sum.total); }
  for (const r of bills) {
    const f = get(r.projectId);
    if (!f) continue;
    f.supplierBilled = dec2(r._sum.total);
    f.supplierBilledTaxable = dec2(r._sum.taxable);
    f.payable = subMoney(dec2(r._sum.netPayable), addMoney(dec2(r._sum.paidAmount), dec2(r._sum.adjustedAmount)));
  }
  for (const r of payOut) { const f = get(r.projectId); if (f) f.paid = dec2(r._sum.amount); }
  for (const r of received) { const f = get(r.project_id); if (f) f.receivedValue = new Prisma.Decimal(r.value ?? 0).toFixed(2); }

  for (const f of out.values()) {
    f.materialCost = cmpMoney(f.receivedValue, f.supplierBilledTaxable) >= 0 ? f.receivedValue : f.supplierBilledTaxable;
    f.margin = subMoney(f.billedTaxable, f.materialCost);
    f.marginPct = cmpMoney(f.billedTaxable, ZERO) > 0 ? percent(f.margin, f.billedTaxable) : null;
  }
  return out;
}

export function sumFinancials(list: ProjectFinancials[]): ProjectFinancials {
  const t = emptyFinancials();
  const keys = ["contractValue", "billed", "billedTaxable", "certified", "received", "receivable", "committed", "receivedValue", "supplierBilled", "supplierBilledTaxable", "paid", "payable", "materialCost", "margin"] as const;
  for (const f of list) for (const k of keys) t[k] = addMoney(t[k], f[k]);
  t.marginPct = cmpMoney(t.billedTaxable, ZERO) > 0 ? percent(t.margin, t.billedTaxable) : null;
  return t;
}
