import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor, type PermissionKey } from "@/lib/permissions/definitions";
import { projectAccessWhere } from "@/lib/permissions/scopes";
import { dec2, dec3 } from "@/modules/commercial/core";
import { startOfToday } from "@/modules/tasks/rules";

/**
 * Commercial reports. Every report requires `reports.commercial` plus the owning module's view
 * permission, and rows are always limited to projects the actor can see. The same definitions
 * feed the on-screen table and the CSV export, so both always agree.
 */

export type ColType = "text" | "money" | "qty" | "date" | "int";
export type Column = { key: string; label: string; type: ColType };
export type ReportRow = Record<string, string | number | null> & { _href?: string | null };

export const reportFilters = z.object({
  projectId: z.string().uuid().optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});
export type ReportFilters = z.infer<typeof reportFilters>;

type Def = {
  key: string;
  title: string;
  description: string;
  permission: PermissionKey;
  dated: boolean;
  columns: Column[];
  run: (actor: Actor, f: ReportFilters) => Promise<ReportRow[]>;
};

const LIMIT = 5000;
const today = () => startOfToday();
const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : null);
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86_400_000);
const bucket = (days: number) => (days <= 0 ? "Not due" : days <= 30 ? "1–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "Over 90 days");

/** Project scope + optional project filter for models whose projectId is nullable or required. */
function scoped(actor: Actor, f: ReportFilters): { organizationId: string; projectId?: string; project?: { is: Prisma.ProjectWhereInput } } {
  return {
    organizationId: actor.organizationId,
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(can(actor, "projects.view_all") ? {} : { project: { is: projectAccessWhere(actor) } }),
  };
}
function range(f: ReportFilters) {
  if (!f.from && !f.to) return undefined;
  return { ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}), ...(f.to ? { lte: new Date(`${f.to}T00:00:00Z`) } : {}) };
}

const OPEN_PO = ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"] as const;

export const REPORTS: Def[] = [
  {
    key: "po-register",
    title: "Purchase order register",
    description: "All purchase orders with value, delivery date and receipt progress.",
    permission: "po.view",
    dated: true,
    columns: [
      { key: "number", label: "PO", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "project", label: "Project", type: "text" }, { key: "supplier", label: "Supplier", type: "text" },
      { key: "status", label: "Status", type: "text" }, { key: "expected", label: "Expected", type: "date" }, { key: "taxable", label: "Taxable", type: "money" }, { key: "total", label: "Total", type: "money" }, { key: "receivedPct", label: "Received %", type: "int" },
    ],
    run: async (actor, f) => {
      const rows = await db.purchaseOrder.findMany({ where: { ...scoped(actor, f), orderDate: range(f) }, orderBy: { orderDate: "desc" }, take: LIMIT, include: { project: { select: { code: true } }, party: { select: { name: true } }, lines: { select: { quantity: true, acceptedQty: true } } } });
      return rows.map((r) => {
        const ordered = r.lines.reduce((a, l) => a + Number(l.quantity), 0);
        const acc = r.lines.reduce((a, l) => a + Number(l.acceptedQty), 0);
        return { _href: `/purchase-orders/${r.id}`, number: r.number, date: d(r.orderDate), project: r.project?.code ?? null, supplier: r.party.name, status: r.status, expected: d(r.expectedDate), taxable: dec2(r.taxable), total: dec2(r.total), receivedPct: ordered ? Math.round((acc / ordered) * 100) : 0 };
      });
    },
  },
  {
    key: "pending-deliveries",
    title: "Pending deliveries",
    description: "Open purchase order lines not yet fully accepted at site, with days overdue.",
    permission: "po.view",
    dated: false,
    columns: [
      { key: "po", label: "PO", type: "text" }, { key: "project", label: "Project", type: "text" }, { key: "supplier", label: "Supplier", type: "text" }, { key: "item", label: "Item", type: "text" }, { key: "brand", label: "Brand", type: "text" },
      { key: "ordered", label: "Ordered", type: "qty" }, { key: "accepted", label: "Accepted", type: "qty" }, { key: "pending", label: "Pending", type: "qty" }, { key: "unit", label: "Unit", type: "text" }, { key: "expected", label: "Expected", type: "date" }, { key: "overdueDays", label: "Days overdue", type: "int" },
    ],
    run: async (actor, f) => {
      const t = today();
      const lines = await db.poLine.findMany({ where: { po: { ...scoped(actor, f), status: { in: [...OPEN_PO] } } }, take: LIMIT, orderBy: [{ po: { expectedDate: { sort: "asc", nulls: "last" } } }, { lineNo: "asc" }], include: { po: { select: { id: true, number: true, expectedDate: true, project: { select: { code: true } }, party: { select: { name: true } } } }, itemBrand: { select: { item: { select: { name: true } }, brand: { select: { name: true } } } } } });
      return lines
        .filter((l) => l.quantity.gt(l.acceptedQty))
        .map((l) => ({ _href: `/purchase-orders/${l.po.id}`, po: l.po.number, project: l.po.project?.code ?? null, supplier: l.po.party.name, item: l.itemBrand.item.name, brand: l.itemBrand.brand.name, ordered: dec3(l.quantity), accepted: dec3(l.acceptedQty), pending: dec3(l.quantity.sub(l.acceptedQty)), unit: l.unit, expected: d(l.po.expectedDate), overdueDays: l.po.expectedDate && l.po.expectedDate < t ? daysBetween(t, l.po.expectedDate) : 0 }));
    },
  },
  {
    key: "grn-register",
    title: "Site receipt (GRN) register",
    description: "Material receipts with received, accepted and rejected quantities.",
    permission: "grn.view",
    dated: true,
    columns: [
      { key: "number", label: "GRN", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "project", label: "Project", type: "text" }, { key: "location", label: "Location", type: "text" }, { key: "supplier", label: "Supplier", type: "text" },
      { key: "against", label: "Against", type: "text" }, { key: "status", label: "Status", type: "text" }, { key: "received", label: "Received", type: "qty" }, { key: "accepted", label: "Accepted", type: "qty" }, { key: "rejected", label: "Rejected / damaged", type: "qty" },
    ],
    run: async (actor, f) => {
      const rows = await db.grn.findMany({ where: { ...scoped(actor, f), receiptDate: range(f) }, orderBy: { receiptDate: "desc" }, take: LIMIT, include: { project: { select: { code: true } }, location: { select: { name: true } }, party: { select: { name: true } }, po: { select: { number: true } }, challan: { select: { number: true } }, lines: { select: { receivedQty: true, acceptedQty: true, rejectedQty: true, damagedQty: true } } } });
      return rows.map((r) => ({ _href: `/site-receipts/${r.id}`, number: r.number, date: d(r.receiptDate), project: r.project?.code ?? null, location: r.location.name, supplier: r.party?.name ?? null, against: r.po?.number ?? r.challan?.number ?? null, status: r.status, received: sumQ(r.lines.map((l) => l.receivedQty)), accepted: sumQ(r.lines.map((l) => l.acceptedQty)), rejected: sumQ(r.lines.flatMap((l) => [l.rejectedQty, l.damagedQty])) }));
    },
  },
  {
    key: "supplier-bills",
    title: "Supplier bills & ageing",
    description: "Supplier bills with TDS, payments, outstanding and how long they are overdue.",
    permission: "bills.view",
    dated: true,
    columns: [
      { key: "number", label: "Bill", type: "text" }, { key: "invoiceNo", label: "Supplier invoice", type: "text" }, { key: "date", label: "Invoice date", type: "date" }, { key: "due", label: "Due", type: "date" }, { key: "project", label: "Project", type: "text" }, { key: "supplier", label: "Supplier", type: "text" },
      { key: "status", label: "Status", type: "text" }, { key: "match", label: "Match", type: "text" }, { key: "total", label: "Total", type: "money" }, { key: "tds", label: "TDS", type: "money" }, { key: "netPayable", label: "Net payable", type: "money" }, { key: "paid", label: "Paid / adjusted", type: "money" }, { key: "outstanding", label: "Outstanding", type: "money" }, { key: "ageing", label: "Ageing", type: "text" },
    ],
    run: async (actor, f) => {
      const t = today();
      const rows = await db.supplierBill.findMany({ where: { ...scoped(actor, f), status: { not: "CANCELLED" }, invoiceDate: range(f) }, orderBy: { invoiceDate: "desc" }, take: LIMIT, include: { project: { select: { code: true } }, party: { select: { name: true } } } });
      return rows.map((r) => {
        const settled = r.paidAmount.add(r.adjustedAmount);
        const out = r.netPayable.sub(settled);
        const live = ["APPROVED", "PARTIALLY_PAID"].includes(r.status) && out.gt(0);
        return { _href: `/supplier-bills/${r.id}`, number: r.number, invoiceNo: r.supplierInvoiceNo, date: d(r.invoiceDate), due: d(r.dueDate), project: r.project?.code ?? null, supplier: r.party.name, status: r.status, match: r.matchStatus, total: dec2(r.total), tds: dec2(r.tdsAmount), netPayable: dec2(r.netPayable), paid: dec2(settled), outstanding: live ? dec2(out) : "0.00", ageing: live ? bucket(r.dueDate ? daysBetween(t, r.dueDate) : 0) : "—" };
      });
    },
  },
  {
    key: "payments",
    title: "Payments & receipts register",
    description: "Supplier payments and client receipts, with allocated and unallocated (advance) amounts.",
    permission: "payments.view",
    dated: true,
    columns: [
      { key: "number", label: "Number", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "direction", label: "Type", type: "text" }, { key: "party", label: "Party", type: "text" }, { key: "project", label: "Project", type: "text" }, { key: "mode", label: "Mode", type: "text" },
      { key: "reference", label: "Reference", type: "text" }, { key: "amount", label: "Amount", type: "money" }, { key: "tds", label: "TDS", type: "money" }, { key: "allocated", label: "Allocated", type: "money" }, { key: "advance", label: "Unallocated", type: "money" }, { key: "status", label: "Status", type: "text" },
    ],
    run: async (actor, f) => {
      const rows = await db.payment.findMany({ where: { ...scoped(actor, f), paymentDate: range(f) }, orderBy: { paymentDate: "desc" }, take: LIMIT, include: { project: { select: { code: true } }, party: { select: { name: true } } } });
      return rows.map((r) => ({ _href: `/payments/${r.id}`, number: r.number, date: d(r.paymentDate), direction: r.direction === "OUT" ? "Payment" : "Receipt", party: r.party.name, project: r.project?.code ?? null, mode: r.mode.replace(/_/g, " ").toLowerCase(), reference: r.reference, amount: dec2(r.amount), tds: dec2(r.tdsAmount), allocated: dec2(r.allocatedAmount), advance: r.status === "POSTED" ? dec2(r.amount.add(r.tdsAmount).sub(r.allocatedAmount)) : "0.00", status: r.status }));
    },
  },
  {
    key: "receivables",
    title: "Receivables ageing",
    description: "Issued client invoices that are not fully received, grouped by how long they are overdue.",
    permission: "invoice.view",
    dated: false,
    columns: [
      { key: "number", label: "Invoice", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "due", label: "Due", type: "date" }, { key: "project", label: "Project", type: "text" }, { key: "client", label: "Client", type: "text" },
      { key: "netReceivable", label: "Net receivable", type: "money" }, { key: "received", label: "Received / adjusted", type: "money" }, { key: "outstanding", label: "Outstanding", type: "money" }, { key: "overdueDays", label: "Days overdue", type: "int" }, { key: "ageing", label: "Ageing", type: "text" },
    ],
    run: async (actor, f) => {
      const t = today();
      const rows = await db.clientInvoice.findMany({ where: { ...scoped(actor, f), status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, orderBy: { dueDate: { sort: "asc", nulls: "last" } }, take: LIMIT, include: { project: { select: { code: true } }, party: { select: { name: true } } } });
      return rows
        .map((r) => {
          const got = r.receivedAmount.add(r.adjustedAmount);
          const out = r.netReceivable.sub(got);
          const od = r.dueDate ? daysBetween(t, r.dueDate) : 0;
          return { _href: `/client-invoices/${r.id}`, number: r.number, date: d(r.invoiceDate), due: d(r.dueDate), project: r.project.code, client: r.party.name, netReceivable: dec2(r.netReceivable), received: dec2(got), outstanding: dec2(out), overdueDays: Math.max(0, od), ageing: bucket(od), _out: Number(out) };
        })
        .filter((r) => r._out > 0)
        .map(omit("_out"));
    },
  },
  {
    key: "stock-by-location",
    title: "Stock by location",
    description: "On-hand, reserved and available quantity for every item–brand at every location.",
    permission: "items.view",
    dated: false,
    columns: [
      { key: "location", label: "Location", type: "text" }, { key: "project", label: "Project", type: "text" }, { key: "item", label: "Item", type: "text" }, { key: "brand", label: "Brand", type: "text" }, { key: "unit", label: "Unit", type: "text" },
      { key: "onHand", label: "On hand", type: "qty" }, { key: "reserved", label: "Reserved", type: "qty" }, { key: "available", label: "Available", type: "qty" },
    ],
    run: async (actor, f) => {
      const locWhere: Prisma.StockLocationWhereInput = f.projectId
        ? { projectId: f.projectId, ...(can(actor, "projects.view_all") ? {} : { project: { is: projectAccessWhere(actor) } }) }
        : can(actor, "projects.view_all") ? {} : { OR: [{ projectId: null }, { project: { is: projectAccessWhere(actor) } }] };
      const rows = await db.stockBalance.findMany({ where: { organizationId: actor.organizationId, onHand: { not: 0 }, location: locWhere }, take: LIMIT, orderBy: [{ location: { name: "asc" } }, { itemBrand: { item: { name: "asc" } } }], include: { location: { select: { id: true, name: true, project: { select: { code: true } } } }, itemBrand: { select: { item: { select: { name: true, unit: true } }, brand: { select: { name: true } } } } } });
      const res = await db.stockReservation.groupBy({ by: ["itemBrandId", "locationId"], where: { organizationId: actor.organizationId, status: "ACTIVE", locationId: { in: [...new Set(rows.map((r) => r.locationId))] } }, _sum: { quantity: true, issuedQty: true } });
      const resMap = new Map(res.map((r) => [`${r.itemBrandId}:${r.locationId}`, Number(r._sum.quantity ?? 0) - Number(r._sum.issuedQty ?? 0)]));
      return rows.map((r) => {
        const reserved = resMap.get(`${r.itemBrandId}:${r.locationId}`) ?? 0;
        return { location: r.location.name, project: r.location.project?.code ?? null, item: r.itemBrand.item.name, brand: r.itemBrand.brand.name, unit: r.itemBrand.item.unit, onHand: dec3(r.onHand), reserved: String(Math.round(reserved * 1000) / 1000), available: String(Math.round((Number(r.onHand) - reserved) * 1000) / 1000) };
      });
    },
  },
  {
    key: "mrp-shortages",
    title: "Material shortages",
    description: "Open project requirements not yet covered by site stock, open orders, open requisitions or consumption.",
    permission: "mrp.view",
    dated: false,
    columns: [
      { key: "project", label: "Project", type: "text" }, { key: "item", label: "Item", type: "text" }, { key: "brand", label: "Brand", type: "text" }, { key: "unit", label: "Unit", type: "text" }, { key: "required", label: "Required", type: "qty" },
      { key: "covered", label: "Covered", type: "qty" }, { key: "shortage", label: "Shortage", type: "qty" }, { key: "requiredBy", label: "Required by", type: "date" },
    ],
    run: async (actor, f) => {
      const projectIds = f.projectId
        ? [f.projectId]
        : (await db.project.findMany({ where: projectAccessWhere(actor), select: { id: true } })).map((p) => p.id);
      if (!projectIds.length) return [];
      const rows = await db.$queryRaw<{ project_id: string; code: string; item: string; brand: string; unit: string; required: string; covered: string; required_by: Date | null }[]>`
        SELECT r.project_id::text, p.code, i.name AS item, b.name AS brand, i.unit, r.required_qty::text AS required, r.required_by,
          (COALESCE((SELECT SUM(sb.on_hand) FROM stock_balances sb JOIN stock_locations l ON l.id = sb.location_id WHERE sb.item_brand_id = r.item_brand_id AND l.project_id = r.project_id), 0)
          + COALESCE((SELECT SUM(pl.quantity - pl.accepted_qty) FROM po_lines pl JOIN purchase_orders po ON po.id = pl.po_id WHERE pl.item_brand_id = r.item_brand_id AND po.project_id = r.project_id AND po.status IN ('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACKNOWLEDGED','PARTIALLY_RECEIVED')), 0)
          + COALESCE((SELECT SUM(prl.quantity - prl.ordered_qty) FROM pr_lines prl JOIN purchase_requisitions pr ON pr.id = prl.pr_id WHERE prl.item_brand_id = r.item_brand_id AND pr.project_id = r.project_id AND pr.status IN ('DRAFT','SUBMITTED','APPROVED','PARTIALLY_ORDERED')), 0)
          + COALESCE((SELECT SUM(t.quantity) FROM stock_transactions t WHERE t.item_brand_id = r.item_brand_id AND t.project_id = r.project_id AND t.type = 'CONSUMPTION'), 0))::text AS covered
        FROM material_requirements r
        JOIN projects p ON p.id = r.project_id
        JOIN item_brands ib ON ib.id = r.item_brand_id
        JOIN items i ON i.id = ib.item_id
        JOIN brands b ON b.id = ib.brand_id
        WHERE r.organization_id = ${actor.organizationId}::uuid AND r.status = 'OPEN' AND r.project_id = ANY(${projectIds}::uuid[])
        ORDER BY r.required_by NULLS LAST, p.code`;
      return rows
        .map((r) => ({ project: r.code, item: r.item, brand: r.brand, unit: r.unit, required: trimQ(r.required), covered: trimQ(r.covered), shortage: trimQ(String(Number(r.required) - Number(r.covered))), requiredBy: d(r.required_by), _href: `/projects/${r.project_id}?tab=planning`, _s: Number(r.required) - Number(r.covered) }))
        .filter((r) => r._s > 0)
        .map(omit("_s"));
    },
  },
];

function omit<K extends string>(key: K) {
  return <T extends Record<K, unknown>>(row: T): Omit<T, K> => {
    const copy: Partial<T> = { ...row };
    delete copy[key];
    return copy as Omit<T, K>;
  };
}

function sumQ(values: Prisma.Decimal[]) {
  return trimQ(String(values.reduce((a, v) => a + Number(v), 0)));
}
function trimQ(v: string) {
  const n = Math.round(Number(v) * 1000) / 1000;
  return String(n);
}

export function reportByKey(key: string) {
  return REPORTS.find((r) => r.key === key) ?? null;
}

export function availableReports(actor: Actor) {
  if (!can(actor, "reports.commercial")) return [];
  return REPORTS.filter((r) => can(actor, r.permission));
}

export async function runReport(actor: Actor, key: string, raw: unknown) {
  const def = reportByKey(key);
  if (!def) throw new NotFoundError("Report");
  if (!can(actor, "reports.commercial") || !can(actor, def.permission)) throw new ForbiddenError("You do not have access to this report.");
  const filters = reportFilters.parse(raw ?? {});
  const rows = await def.run(actor, filters);
  return { def: { key: def.key, title: def.title, description: def.description, columns: def.columns, dated: def.dated }, filters, rows };
}

/** RFC 4180 CSV; cells that could be read as spreadsheet formulas are prefixed with an apostrophe. */
export function toCsv(columns: Column[], rows: ReportRow[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(","))].join("\r\n");
}
