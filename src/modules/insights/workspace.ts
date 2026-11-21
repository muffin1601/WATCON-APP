import "server-only";
import { db } from "@/lib/db";
import { can, type Actor, type PermissionKey } from "@/lib/permissions/definitions";
import { assertProjectVisible, dec2 } from "@/modules/commercial/core";
import { startOfToday } from "@/modules/tasks/rules";
import { listApprovals } from "./approvals";
import { projectFinancials } from "./finance";

/**
 * Read-only views behind the project workspace: one project, every commercial document type.
 * The project's visibility is asserted first (invisible → 404), and every query is filtered
 * to that project, so module records follow the same project scoping as their own pages.
 */

export type DocKind = "pr" | "rfq" | "po" | "grn" | "challan" | "bill" | "payment" | "note" | "cpo" | "so" | "rabill" | "invoice" | "receipt";

export type DocRow = {
  id: string;
  number: string;
  href: string;
  date: string | null;
  title: string | null;
  party: string | null;
  status: string;
  amount: string | null;
  secondary: string | null;
  overdue: boolean;
};

type KindDef = {
  label: string;
  plural: string;
  view: PermissionKey;
  create: PermissionKey | null;
  path: string;
  newHref: ((projectId: string) => string) | null;
  newLabel: string | null;
  about: string;
};

export const DOC_KINDS: Record<DocKind, KindDef> = {
  pr: { label: "Requisition", plural: "Purchase requisitions", view: "pr.view", create: "pr.create", path: "/purchase-requisitions", newHref: (p) => `/purchase-requisitions/new?projectId=${p}`, newLabel: "New requisition", about: "Site and store requests for material. Once approved, purchasing gets rates or raises a purchase order." },
  rfq: { label: "Rate enquiry", plural: "Rate enquiries", view: "rfq.view", create: "rfq.manage", path: "/rate-enquiries", newHref: (p) => `/rate-enquiries/new?projectId=${p}`, newLabel: "New rate enquiry", about: "Ask several suppliers for prices, compare quotations side by side and award the best offer." },
  po: { label: "Purchase order", plural: "Purchase orders", view: "po.view", create: "po.create", path: "/purchase-orders", newHref: (p) => `/purchase-orders/new?projectId=${p}`, newLabel: "New purchase order", about: "Orders placed on suppliers for this project. Approved orders appear as pending deliveries at site." },
  grn: { label: "Site receipt", plural: "Site receipts (GRN)", view: "grn.view", create: "grn.create", path: "/site-receipts", newHref: (p) => `/site-receipts?projectId=${p}`, newLabel: "Receive material", about: "Material received at site against a purchase order or transfer — with photos, signed challan and accepted / rejected quantities." },
  challan: { label: "Challan", plural: "Delivery challans", view: "grn.view", create: "stock.transfer", path: "/challans", newHref: (p) => `/challans/new?projectId=${p}`, newLabel: "New challan", about: "Material moved from the warehouse or another site to this project, returned to store or supplier, or delivered to the client." },
  bill: { label: "Supplier bill", plural: "Supplier bills", view: "bills.view", create: "bills.manage", path: "/supplier-bills", newHref: (p) => `/supplier-bills/new?projectId=${p}`, newLabel: "Enter supplier bill", about: "Supplier invoices for this project, matched against the purchase order and site receipts before payment." },
  payment: { label: "Payment", plural: "Supplier payments", view: "payments.view", create: "payments.manage", path: "/payments", newHref: (p) => `/payments/new?direction=OUT&projectId=${p}`, newLabel: "Record payment", about: "Money paid to suppliers for this project. Unallocated amounts are kept as supplier advances." },
  note: { label: "Note", plural: "Credit / debit notes", view: "bills.view", create: "bills.manage", path: "/notes", newHref: (p) => `/notes/new?projectId=${p}`, newLabel: "New note", about: "Adjustments to supplier bills or client invoices — price differences, returns or short supplies." },
  cpo: { label: "Client PO", plural: "Client purchase orders", view: "cpo.view", create: "cpo.manage", path: "/client-pos", newHref: (p) => `/client-pos/new?projectId=${p}`, newLabel: "New client PO", about: "The client's order or contract for this project — the ceiling for everything that can be billed." },
  so: { label: "Sales order", plural: "Sales orders", view: "so.view", create: "so.manage", path: "/sales-orders", newHref: (p) => `/sales-orders/new?projectId=${p}`, newLabel: "New sales order", about: "Supply orders drawn from the client PO. They drive deliveries to the client and supply invoices." },
  rabill: { label: "Running bill", plural: "Running bills (RA)", view: "rabill.view", create: "rabill.manage", path: "/running-bills", newHref: (p) => `/running-bills/new?projectId=${p}`, newLabel: "New running bill", about: "Periodic bills of work done, claimed against the client PO and certified by the client." },
  invoice: { label: "Invoice", plural: "Client invoices", view: "invoice.view", create: "invoice.manage", path: "/client-invoices", newHref: (p) => `/client-invoices/new?projectId=${p}`, newLabel: "New invoice", about: "GST tax invoices raised on the client for certified running bills or supplies." },
  receipt: { label: "Receipt", plural: "Client receipts", view: "payments.view", create: "payments.manage", path: "/payments", newHref: (p) => `/payments/new?direction=IN&projectId=${p}`, newLabel: "Record receipt", about: "Money received from the client for this project, allocated to invoices. TDS deducted by the client counts as received." },
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const day = (d: Date) => d.toISOString().slice(0, 10);
export const DOC_PAGE_SIZE = 25;

/** Status values per document kind (for the tab status filter). */
export const DOC_STATUSES: Record<DocKind, string[]> = {
  pr: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PARTIALLY_ORDERED", "ORDERED", "CLOSED", "CANCELLED"],
  rfq: ["DRAFT", "SENT", "RESPONSES_IN", "AWARD_PENDING", "AWARDED", "CLOSED", "CANCELLED"],
  po: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"],
  grn: ["DRAFT", "SUBMITTED", "POSTED", "REJECTED", "CANCELLED", "REVERSED"],
  challan: ["DRAFT", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "DELIVERED", "CLOSED", "CANCELLED"],
  bill: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  payment: ["POSTED", "CANCELLED"],
  receipt: ["POSTED", "CANCELLED"],
  note: ["DRAFT", "APPROVED", "CANCELLED"],
  cpo: ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "REJECTED", "COMPLETED", "CLOSED", "CANCELLED"],
  so: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PARTIALLY_FULFILLED", "FULFILLED", "CLOSED", "CANCELLED"],
  rabill: ["DRAFT", "INTERNAL_REVIEW", "SUBMITTED", "CLIENT_CERTIFIED", "DISPUTED", "INVOICED", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  invoice: ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"],
};

/** What counts as "needs action" per kind, shown as a badge on the tab (e.g. "3 awaiting approval"). */
export const DOC_PENDING: Partial<Record<DocKind, { statuses: string[]; label: string }>> = {
  pr: { statuses: ["SUBMITTED"], label: "awaiting approval" },
  rfq: { statuses: ["AWARD_PENDING"], label: "award to approve" },
  po: { statuses: ["PENDING_APPROVAL"], label: "awaiting approval" },
  grn: { statuses: ["SUBMITTED"], label: "to verify" },
  challan: { statuses: ["DISPATCHED"], label: "in transit" },
  bill: { statuses: ["PENDING_APPROVAL"], label: "awaiting approval" },
  note: { statuses: ["DRAFT"], label: "drafts" },
  cpo: { statuses: ["PENDING_APPROVAL"], label: "awaiting approval" },
  so: { statuses: ["PENDING_APPROVAL"], label: "awaiting approval" },
  rabill: { statuses: ["INTERNAL_REVIEW"], label: "in review" },
  invoice: { statuses: ["DRAFT"], label: "drafts" },
};

export type DocListQuery = { q?: string; status?: string; page?: number; pageSize?: number };
export type DocPage = { rows: DocRow[]; total: number; page: number; pageSize: number };

const contains = (v: string) => ({ contains: v, mode: "insensitive" as const });

/** One project's documents of one kind: search, status filter and pagination (newest first). */
export async function listProjectDocs(actor: Actor, projectId: string, kind: DocKind, query: DocListQuery = {}): Promise<DocPage> {
  const pageSize = Math.min(100, Math.max(5, Math.floor(query.pageSize ?? DOC_PAGE_SIZE) || DOC_PAGE_SIZE));
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1);
  if (!can(actor, DOC_KINDS[kind].view)) return { rows: [], total: 0, page, pageSize };
  await assertProjectVisible(actor, projectId);
  const q = query.q?.trim().slice(0, 100) || undefined;
  const status = query.status && DOC_STATUSES[kind].includes(query.status) ? query.status : undefined;
  const base = { organizationId: actor.organizationId, projectId, ...(status ? { status: status as never } : {}) };
  const skip = (page - 1) * pageSize;
  const path = DOC_KINDS[kind].path;
  const today = startOfToday();
  const party = q ? [{ party: { is: { name: contains(q) } } }] : [];
  const or = (...extra: object[]) => (q ? { OR: [{ number: contains(q) }, ...party, ...extra] } : {});
  const out = async <T>(where: object, count: (a: { where: never }) => Promise<number>, find: () => Promise<T[]>, map: (r: T) => DocRow): Promise<DocPage> => {
    const [total, rows] = await Promise.all([count({ where: where as never }), find()]);
    return { rows: rows.map(map), total, page, pageSize };
  };

  switch (kind) {
    case "pr": {
      const where = { ...base, ...(q ? { OR: [{ number: contains(q) }, { purpose: contains(q) }] } : {}) };
      return out(where, (a) => db.purchaseRequisition.count(a), () => db.purchaseRequisition.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize, include: { _count: { select: { lines: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.createdAt), title: r.purpose, party: null, status: r.status, amount: null, secondary: `${r._count.lines} line${r._count.lines === 1 ? "" : "s"}${r.requiredBy ? ` · needed by ${day(r.requiredBy)}` : ""}`, overdue: false }));
    }
    case "rfq": {
      const where = { ...base, ...(q ? { OR: [{ number: contains(q) }, { title: contains(q) }] } : {}) };
      return out(where, (a) => db.rfq.count(a), () => db.rfq.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize, include: { _count: { select: { suppliers: true, quotations: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.createdAt), title: r.title, party: null, status: r.status, amount: null, secondary: `${r._count.quotations} of ${r._count.suppliers} suppliers quoted`, overdue: false }));
    }
    case "po": {
      const where = { ...base, ...or() };
      return out(where, (a) => db.purchaseOrder.count(a), () => db.purchaseOrder.findMany({ where, orderBy: { orderDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } } } }), (r) => ({ id: r.id, number: r.revision ? `${r.number} rev ${r.revision}` : r.number, href: `${path}/${r.id}`, date: iso(r.orderDate), title: null, party: r.party.name, status: r.status, amount: dec2(r.total), secondary: r.expectedDate ? `Expected ${day(r.expectedDate)}` : null, overdue: !!r.expectedDate && r.expectedDate < today && OPEN_PO.includes(r.status) }));
    }
    case "grn": {
      const where = { ...base, ...or({ supplierChallanNo: contains(q ?? "") }) };
      return out(where, (a) => db.grn.count(a), () => db.grn.findMany({ where, orderBy: { receiptDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } }, po: { select: { number: true } }, challan: { select: { number: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.receiptDate), title: r.po ? `Against ${r.po.number}` : r.challan ? `Against ${r.challan.number}` : null, party: r.party?.name ?? null, status: r.status, amount: null, secondary: r.supplierChallanNo ? `Supplier challan ${r.supplierChallanNo}` : null, overdue: false }));
    }
    case "challan": {
      const where = { ...base, ...or({ vehicleNo: contains(q ?? "") }) };
      return out(where, (a) => db.challan.count(a), () => db.challan.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize, include: { fromLocation: { select: { name: true } }, toLocation: { select: { name: true } }, party: { select: { name: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.dispatchDate ?? r.createdAt), title: CHALLAN_LABEL[r.type] ?? r.type, party: r.party?.name ?? null, status: r.status, amount: null, secondary: [r.fromLocation?.name, r.toLocation?.name].filter(Boolean).join(" → ") || null, overdue: r.status === "DISPATCHED" && !!r.expectedDate && r.expectedDate < today }));
    }
    case "bill": {
      const where = { ...base, ...or({ supplierInvoiceNo: contains(q ?? "") }) };
      return out(where, (a) => db.supplierBill.count(a), () => db.supplierBill.findMany({ where, orderBy: { invoiceDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.invoiceDate), title: `Supplier invoice ${r.supplierInvoiceNo}`, party: r.party.name, status: r.status, amount: dec2(r.total), secondary: r.matchStatus === "EXCEPTION" ? "Match exceptions" : r.dueDate ? `Due ${day(r.dueDate)}` : null, overdue: !!r.dueDate && r.dueDate < today && ["APPROVED", "PARTIALLY_PAID"].includes(r.status) }));
    }
    case "payment":
    case "receipt": {
      const where = { ...base, direction: kind === "payment" ? ("OUT" as const) : ("IN" as const), ...or({ reference: contains(q ?? "") }) };
      return out(where, (a) => db.payment.count(a), () => db.payment.findMany({ where, orderBy: { paymentDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.paymentDate), title: `${r.mode.replace(/_/g, " ").toLowerCase()}${r.reference ? ` · ${r.reference}` : ""}`, party: r.party.name, status: r.status, amount: dec2(r.amount), secondary: r.status === "POSTED" && r.allocatedAmount.lt(r.amount.add(r.tdsAmount)) ? `Unallocated ${r.amount.add(r.tdsAmount).sub(r.allocatedAmount).toFixed(2)}` : null, overdue: false }));
    }
    case "note": {
      const where = { ...base, ...or({ reason: contains(q ?? "") }) };
      return out(where, (a) => db.adjustmentNote.count(a), () => db.adjustmentNote.findMany({ where, orderBy: { noteDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.noteDate), title: `${r.noteType === "CREDIT" ? "Credit" : "Debit"} note · ${r.partyRole === "SUPPLIER" ? "supplier" : "client"}`, party: r.party.name, status: r.status, amount: dec2(r.total), secondary: r.reason, overdue: false }));
    }
    case "cpo": {
      const where = { ...base, ...or({ clientPoNumber: contains(q ?? "") }) };
      return out(where, (a) => db.clientPo.count(a), () => db.clientPo.findMany({ where, orderBy: { poDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } } } }), (r) => ({ id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.poDate), title: `Client ref ${r.clientPoNumber}${r.revision ? ` · rev ${r.revision}` : ""}`, party: r.party.name, status: r.status, amount: dec2(r.total), secondary: r.endDate ? `Ends ${day(r.endDate)}` : null, overdue: false }));
    }
    case "so": {
      const where = { ...base, ...or() };
      return out(where, (a) => db.salesOrder.count(a), () => db.salesOrder.findMany({ where, orderBy: { orderDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } }, clientPo: { select: { number: true } } } }), (r) => ({ id: r.id, number: r.revision ? `${r.number} rev ${r.revision}` : r.number, href: `${path}/${r.id}`, date: iso(r.orderDate), title: r.clientPo ? `Under ${r.clientPo.number}` : null, party: r.party.name, status: r.status, amount: dec2(r.total), secondary: r.deliveryDate ? `Deliver by ${day(r.deliveryDate)}` : null, overdue: !!r.deliveryDate && r.deliveryDate < today && ["APPROVED", "PARTIALLY_FULFILLED"].includes(r.status) }));
    }
    case "rabill": {
      const where = { ...base, ...or() };
      return out(where, (a) => db.raBill.count(a), () => db.raBill.findMany({ where, orderBy: { billDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } }, clientPo: { select: { number: true } } } }), (r) => ({ id: r.id, number: `${r.number} (RA-${r.raNumber})`, href: `${path}/${r.id}`, date: iso(r.billDate), title: `${r.clientPo.number} · ${day(r.periodFrom)} to ${day(r.periodTo)}`, party: r.party.name, status: r.status, amount: dec2(r.certifiedAmount.gt(0) ? r.certifiedAmount : r.claimedAmount), secondary: r.certifiedAmount.gt(0) ? `Claimed ${dec2(r.claimedAmount)}` : "Claimed (not yet certified)", overdue: false }));
    }
    case "invoice": {
      const where = { ...base, ...or() };
      return out(where, (a) => db.clientInvoice.count(a), () => db.clientInvoice.findMany({ where, orderBy: { invoiceDate: "desc" }, skip, take: pageSize, include: { party: { select: { name: true } } } }), (r) => {
        const outstanding = r.netReceivable.sub(r.receivedAmount).sub(r.adjustedAmount);
        const open = ["ISSUED", "PARTIALLY_PAID"].includes(r.status);
        return { id: r.id, number: r.number, href: `${path}/${r.id}`, date: iso(r.invoiceDate), title: null, party: r.party.name, status: r.status, amount: dec2(r.total), secondary: open ? `Outstanding ${outstanding.toFixed(2)}` : null, overdue: !!r.dueDate && r.dueDate < today && open };
      });
    }
  }
}

const OPEN_PO: string[] = ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"];
const CHALLAN_LABEL: Record<string, string> = { ISSUE_TO_SITE: "Issue to site", SITE_TO_SITE: "Site to site", RETURN_TO_STORE: "Return to store", RETURN_TO_SUPPLIER: "Return to supplier", CLIENT_DELIVERY: "Client delivery" };

export type DocCount = { total: number; pending: number; pendingLabel: string | null };

/** Per-kind totals and "needs action" counts for the tab badges (only kinds the actor may view). */
export async function projectDocCounts(actor: Actor, projectId: string): Promise<Partial<Record<DocKind, DocCount>>> {
  const kinds = (Object.keys(DOC_KINDS) as DocKind[]).filter((k) => can(actor, DOC_KINDS[k].view));
  const w = { organizationId: actor.organizationId, projectId };
  const grouped = async (k: DocKind): Promise<{ status: string; n: number }[]> => {
    const map = (rows: { status: string; _count: number }[]) => rows.map((r) => ({ status: r.status, n: r._count }));
    switch (k) {
      case "pr": { const r = await db.purchaseRequisition.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "rfq": { const r = await db.rfq.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "po": { const r = await db.purchaseOrder.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "grn": { const r = await db.grn.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "challan": { const r = await db.challan.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "bill": { const r = await db.supplierBill.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "payment": { const r = await db.payment.groupBy({ by: ["status"], _count: true, where: { ...w, direction: "OUT" } }); return map(r); }
      case "receipt": { const r = await db.payment.groupBy({ by: ["status"], _count: true, where: { ...w, direction: "IN" } }); return map(r); }
      case "note": { const r = await db.adjustmentNote.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "cpo": { const r = await db.clientPo.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "so": { const r = await db.salesOrder.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "rabill": { const r = await db.raBill.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
      case "invoice": { const r = await db.clientInvoice.groupBy({ by: ["status"], _count: true, where: w }); return map(r); }
    }
  };
  const res = await Promise.all(kinds.map(async (k) => [k, await grouped(k)] as const));
  return Object.fromEntries(
    res.map(([k, rows]) => {
      const p = DOC_PENDING[k];
      return [k, { total: rows.reduce((a, r) => a + r.n, 0), pending: p ? rows.filter((r) => p.statuses.includes(r.status)).reduce((a, r) => a + r.n, 0) : 0, pendingLabel: p?.label ?? null }];
    }),
  );
}

export type AttentionItem = { key: string; tone: "bad" | "warn" | "info"; title: string; detail: string; href: string };

/** Command-center data for one project: financial KPIs, material status and what needs attention. */
export async function projectCommandCenter(actor: Actor, projectId: string) {
  await assertProjectVisible(actor, projectId);
  const w = { organizationId: actor.organizationId, projectId };
  const today = startOfToday();
  const seeMoney = can(actor, "accounts.view");
  const [fin, approvals, overduePos, openPoCount, grnsToPost, billExceptions, transitLate, overdueInvoices, shortages] = await Promise.all([
    seeMoney ? projectFinancials(actor.organizationId, [projectId]).then((m) => m.get(projectId)!) : Promise.resolve(null),
    can(actor, "approvals.view") ? listApprovals(actor, { projectId }) : Promise.resolve([]),
    can(actor, "po.view") ? db.purchaseOrder.findMany({ where: { ...w, status: { in: ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"] }, expectedDate: { lt: today } }, orderBy: { expectedDate: "asc" }, take: 10, include: { party: { select: { name: true } } } }) : Promise.resolve([]),
    can(actor, "po.view") ? db.purchaseOrder.count({ where: { ...w, status: { in: ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"] } } }) : Promise.resolve(0),
    can(actor, "grn.view") ? db.grn.findMany({ where: { ...w, status: "SUBMITTED" }, orderBy: { submittedAt: "asc" }, take: 10 }) : Promise.resolve([]),
    can(actor, "bills.view") ? db.supplierBill.findMany({ where: { ...w, matchStatus: "EXCEPTION", status: { in: ["DRAFT", "PENDING_APPROVAL"] } }, take: 10, include: { party: { select: { name: true } } } }) : Promise.resolve([]),
    can(actor, "grn.view") ? db.challan.findMany({ where: { ...w, status: "DISPATCHED", expectedDate: { lt: today } }, take: 10 }) : Promise.resolve([]),
    can(actor, "invoice.view") ? db.clientInvoice.findMany({ where: { ...w, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: today } }, take: 10, include: { party: { select: { name: true } } } }) : Promise.resolve([]),
    can(actor, "mrp.view") ? shortageCount(actor.organizationId, projectId) : Promise.resolve(null),
  ]);

  const attention: AttentionItem[] = [];
  for (const a of approvals) attention.push({ key: `ap-${a.id}`, tone: "warn", title: `${a.action}: ${a.number}`, detail: a.mine ? `Waiting for your approval${a.party ? ` · ${a.party}` : ""}` : (a.blockedReason ?? "Waiting for another approver"), href: a.href });
  for (const p of overduePos) attention.push({ key: `po-${p.id}`, tone: "bad", title: `Delivery overdue: ${p.number}`, detail: `${p.party.name} · expected ${p.expectedDate!.toISOString().slice(0, 10)}`, href: `/purchase-orders/${p.id}` });
  for (const c of transitLate) attention.push({ key: `ch-${c.id}`, tone: "bad", title: `Transfer not received: ${c.number}`, detail: `In transit since ${c.dispatchDate?.toISOString().slice(0, 10) ?? "—"}`, href: `/challans/${c.id}` });
  for (const b of billExceptions) attention.push({ key: `sb-${b.id}`, tone: "bad", title: `Bill mismatch: ${b.number}`, detail: `${b.party.name} · invoice ${b.supplierInvoiceNo} does not match the PO / receipts`, href: `/supplier-bills/${b.id}` });
  for (const i of overdueInvoices) attention.push({ key: `inv-${i.id}`, tone: "bad", title: `Payment overdue: ${i.number}`, detail: `${i.party.name} · due ${i.dueDate!.toISOString().slice(0, 10)}`, href: `/client-invoices/${i.id}` });
  if (shortages) attention.push({ key: "mrp", tone: "warn", title: `${shortages} material shortage${shortages === 1 ? "" : "s"} still to order`, detail: "Open material planning to raise a requisition for the shortfall.", href: `/projects/${projectId}?tab=planning&status=SHORTAGE` });

  return {
    financials: fin,
    material: { openPos: openPoCount, overduePos: overduePos.length, grnsToPost: grnsToPost.length, shortages: shortages ?? 0, transitLate: transitLate.length },
    approvals,
    attention,
  };
}

/** Requirement lines with nothing ordered, nothing incoming and not covered by stock (cheap SQL proxy for MRP "shortage"). */
async function shortageCount(organizationId: string, projectId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM material_requirements r
    WHERE r.organization_id = ${organizationId}::uuid AND r.project_id = ${projectId}::uuid AND r.status = 'OPEN'
      AND r.required_qty > COALESCE((
        SELECT SUM(b.on_hand) FROM stock_balances b JOIN stock_locations l ON l.id = b.location_id
        WHERE b.item_brand_id = r.item_brand_id AND l.project_id = r.project_id), 0)
      + COALESCE((
        SELECT SUM(pl.quantity - pl.accepted_qty) FROM po_lines pl JOIN purchase_orders p ON p.id = pl.po_id
        WHERE pl.item_brand_id = r.item_brand_id AND p.project_id = r.project_id
          AND p.status IN ('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACKNOWLEDGED','PARTIALLY_RECEIVED')), 0)
      + COALESCE((
        SELECT SUM(prl.quantity - prl.ordered_qty) FROM pr_lines prl JOIN purchase_requisitions pr ON pr.id = prl.pr_id
        WHERE prl.item_brand_id = r.item_brand_id AND pr.project_id = r.project_id
          AND pr.status IN ('DRAFT','SUBMITTED','APPROVED','PARTIALLY_ORDERED')), 0)
      + COALESCE((
        SELECT SUM(t.quantity) FROM stock_transactions t
        WHERE t.item_brand_id = r.item_brand_id AND t.project_id = r.project_id AND t.type = 'CONSUMPTION'), 0)`;
  return Number(rows[0]?.n ?? 0);
}

/** Project team (manager + members) for the Team tab. */
export async function projectTeam(actor: Actor, projectId: string) {
  await assertProjectVisible(actor, projectId);
  const p = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { manager: { select: { id: true, fullName: true, designation: true, role: { select: { name: true } } } }, members: { orderBy: { addedAt: "asc" }, select: { addedAt: true, user: { select: { id: true, fullName: true, designation: true, employeeCode: true, status: true, role: { select: { name: true } } } } } } },
  });
  return p;
}

export type FlowStep = {
  n: number;
  key: string;
  title: string;
  summary: string;
  state: "done" | "active" | "todo";
  tab: string;
  action: { label: string; href: string } | null;
};

/**
 * The sales-order-driven order flow for a project: SO → planning → requisitions → enquiries / POs →
 * site receipts → client delivery → invoices & receipts. Each step shows live counts and the next
 * action the user can take (only actions they hold the permission for).
 */
export async function projectOrderFlow(actor: Actor, projectId: string): Promise<FlowStep[]> {
  await assertProjectVisible(actor, projectId);
  const w = { organizationId: actor.organizationId, projectId };
  const cnt = (perm: PermissionKey, p: () => Promise<number>) => (can(actor, perm) ? p() : Promise.resolve(0));
  const [soAll, soApproved, soPending, reqOpen, shortages, prAll, prPending, rfqAll, poAll, poOpen, grnPosted, grnToPost, delivAll, invAll, invOpen, rcpAll] = await Promise.all([
    cnt("so.view", () => db.salesOrder.count({ where: { ...w, status: { notIn: ["CANCELLED"] } } })),
    cnt("so.view", () => db.salesOrder.count({ where: { ...w, status: { in: ["APPROVED", "PARTIALLY_FULFILLED", "FULFILLED", "CLOSED"] } } })),
    cnt("so.view", () => db.salesOrder.count({ where: { ...w, status: { in: ["DRAFT", "PENDING_APPROVAL", "REJECTED"] } } })),
    cnt("mrp.view", () => db.materialRequirement.count({ where: { ...w, status: "OPEN" } })),
    can(actor, "mrp.view") ? shortageCount(actor.organizationId, projectId) : Promise.resolve(0),
    cnt("pr.view", () => db.purchaseRequisition.count({ where: { ...w, status: { notIn: ["CANCELLED"] } } })),
    cnt("pr.view", () => db.purchaseRequisition.count({ where: { ...w, status: { in: ["DRAFT", "SUBMITTED"] } } })),
    cnt("rfq.view", () => db.rfq.count({ where: { ...w, status: { notIn: ["CANCELLED"] } } })),
    cnt("po.view", () => db.purchaseOrder.count({ where: { ...w, status: { notIn: ["CANCELLED", "REJECTED"] } } })),
    cnt("po.view", () => db.purchaseOrder.count({ where: { ...w, status: { in: [...OPEN_PO] as never } } })),
    cnt("grn.view", () => db.grn.count({ where: { ...w, status: "POSTED" } })),
    cnt("grn.view", () => db.grn.count({ where: { ...w, status: { in: ["DRAFT", "SUBMITTED"] } } })),
    cnt("grn.view", () => db.challan.count({ where: { ...w, type: "CLIENT_DELIVERY", status: { notIn: ["CANCELLED"] } } })),
    cnt("invoice.view", () => db.clientInvoice.count({ where: { ...w, status: { notIn: ["CANCELLED"] } } })),
    cnt("invoice.view", () => db.clientInvoice.count({ where: { ...w, status: { in: ["ISSUED", "PARTIALLY_PAID"] } } })),
    cnt("payments.view", () => db.payment.count({ where: { ...w, direction: "IN", status: "POSTED" } })),
  ]);
  const q = `projectId=${projectId}`;
  const act = (perm: PermissionKey, label: string, href: string) => (can(actor, perm) ? { label, href } : null);
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  const state = (done: boolean, started: boolean): FlowStep["state"] => (done ? "done" : started ? "active" : "todo");

  return [
    { n: 1, key: "so", title: "Sales order", tab: "sales-orders", state: state(soApproved > 0, soAll > 0), summary: soAll ? `${plural(soApproved, "approved order")}${soPending ? ` · ${soPending} awaiting approval` : ""}` : "Start here: record what the client has ordered.", action: soAll ? act("so.view", "View sales orders", `/projects/${projectId}?tab=sales-orders`) : act("so.manage", "Create sales order", `/sales-orders/new?${q}`) },
    { n: 2, key: "planning", title: "Material planning", tab: "planning", state: state(reqOpen > 0 && shortages === 0, reqOpen > 0), summary: reqOpen ? `${plural(reqOpen, "material line")}${shortages ? ` · ${shortages} still to order` : " · all covered"}` : "Material needs appear here once the sales order is approved.", action: act("mrp.view", shortages ? "Order shortages" : "Open planning", `/projects/${projectId}?tab=planning${shortages ? "&status=SHORTAGE" : ""}`) },
    { n: 3, key: "pr", title: "Requisitions", tab: "requisitions", state: state(prAll > 0 && prPending === 0, prAll > 0), summary: prAll ? `${plural(prAll, "requisition")}${prPending ? ` · ${prPending} not yet approved` : ""}` : "Request the material to be bought.", action: act("pr.create", "New requisition", `/purchase-requisitions/new?${q}`) },
    { n: 4, key: "po", title: "Rates & purchase orders", tab: "purchase-orders", state: state(poAll > 0 && poOpen === 0, poAll + rfqAll > 0), summary: poAll || rfqAll ? `${plural(rfqAll, "enquiry")} · ${plural(poAll, "PO")}${poOpen ? ` · ${poOpen} awaiting delivery` : ""}` : "Compare supplier rates and place orders.", action: act("po.create", "New purchase order", `/purchase-orders/new?${q}`) ?? act("rfq.manage", "New rate enquiry", `/rate-enquiries/new?${q}`) },
    { n: 5, key: "grn", title: "Site receipts", tab: "site-receipts", state: state(grnPosted > 0 && poOpen === 0 && grnToPost === 0, grnPosted + grnToPost > 0), summary: grnPosted || grnToPost ? `${plural(grnPosted, "receipt")} posted${grnToPost ? ` · ${grnToPost} to verify` : ""}` : "Record material as it arrives at site.", action: act("grn.create", "Receive material", `/site-receipts?${q}`) },
    { n: 6, key: "delivery", title: "Client delivery", tab: "challans", state: state(false, delivAll > 0), summary: delivAll ? plural(delivAll, "delivery challan") : "Deliver material to the client against the sales order.", action: act("stock.transfer", "New delivery challan", `/challans/new?type=CLIENT_DELIVERY&${q}`) },
    { n: 7, key: "billing", title: "Invoices & receipts", tab: "invoices", state: state(invAll > 0 && invOpen === 0 && rcpAll > 0, invAll > 0), summary: invAll ? `${plural(invAll, "invoice")}${invOpen ? ` · ${invOpen} unpaid` : ""} · ${plural(rcpAll, "receipt")}` : "Invoice the client and record payments received.", action: act("invoice.manage", "New invoice", `/client-invoices/new?${q}`) },
  ];
}
