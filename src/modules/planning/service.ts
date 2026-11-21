import "server-only";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { db, type Prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { cmpQty, fmtQty, qtyUnits, qtyTimesRate, addMoney } from "@/lib/money";
import { can, type Actor } from "@/lib/permissions/definitions";
import { projectAccessWhere } from "@/lib/permissions/scopes";
import { PRIORITIES, dateString, optionalText, toDbDate, uuid } from "@/lib/validations/common";
import { assertProjectUsable, assertProjectVisible, dec3, dec4, parseInput, requirePermission } from "@/modules/commercial/core";
import { quantity } from "@/modules/inventory/validation";
import { startOfToday } from "@/modules/tasks/rules";
import { computeMrp, type MrpResult } from "./mrp";

// ─────────────────────────── Requirements ───────────────────────────

const requirementSchema = z.object({
  projectId: uuid,
  itemBrandId: uuid,
  requiredQty: quantity,
  requiredBy: z.union([dateString, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  notes: optionalText("Notes", 500),
});

/** Adds a requirement, or updates the existing one for the same project + item–brand. */
export async function saveRequirement(actor: Actor, input: unknown) {
  requirePermission(actor, "mrp.manage");
  const data = parseInput(requirementSchema, input);
  const project = await assertProjectUsable(actor, data.projectId);
  const ib = await db.itemBrand.findFirst({ where: { id: data.itemBrandId, organizationId: actor.organizationId }, include: { item: { select: { name: true, status: true, unit: true } }, brand: { select: { name: true, status: true } } } });
  if (!ib) throw new NotFoundError("Item–brand");
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.materialRequirement.findUnique({ where: { projectId_itemBrandId: { projectId: data.projectId, itemBrandId: data.itemBrandId } } });
      const row = existing
        ? await tx.materialRequirement.update({ where: { id: existing.id }, data: { requiredQty: data.requiredQty, requiredBy: toDbDate(data.requiredBy), priority: data.priority, notes: data.notes, status: "OPEN", version: { increment: 1 } } })
        : await tx.materialRequirement.create({ data: { organizationId: actor.organizationId, projectId: data.projectId, itemBrandId: ib.id, itemId: ib.itemId, requiredQty: data.requiredQty, requiredBy: toDbDate(data.requiredBy), priority: data.priority, notes: data.notes, createdById: actor.id } });
      await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: existing ? "requirement.updated" : "requirement.created", entityType: "material_requirement", entityId: row.id, projectId: data.projectId, summary: `${existing ? "Updated" : "Added"} requirement ${data.requiredQty} ${ib.item.unit} ${ib.item.name} (${ib.brand.name}) for ${project.code}${existing ? ` (was ${dec3(existing.requiredQty)})` : ""}` }, tx);
      return row;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("This item–brand was just added by someone else. Reload and edit it.");
    throw e;
  }
}

export async function setRequirementStatus(actor: Actor, id: string, status: "OPEN" | "CLOSED" | "CANCELLED") {
  requirePermission(actor, "mrp.manage");
  const r = await db.materialRequirement.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!r) throw new NotFoundError("Requirement");
  await assertProjectUsable(actor, r.projectId);
  await db.$transaction(async (tx) => {
    await tx.materialRequirement.update({ where: { id }, data: { status, version: { increment: 1 } } });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: `requirement.${status.toLowerCase()}`, entityType: "material_requirement", entityId: id, projectId: r.projectId, summary: `Requirement marked ${status.toLowerCase()}` }, tx);
  });
}

// ─────────────────────────── MRP ───────────────────────────

export const mrpQuerySchema = z.object({
  projectId: uuid.optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.string().max(30).optional().catch(undefined),
  view: z.enum(["open", "all"]).catch("open").default("open"),
});

type Key = string;
const k = (...parts: (string | null)[]) => parts.map((p) => p ?? "-").join(":");

export type MrpRow = {
  requirementId: string;
  project: { id: string; code: string; name: string };
  salesOrder: { id: string; number: string } | null;
  itemBrandId: string;
  item: { id: string; code: string; name: string; unit: string };
  brand: { id: string; name: string };
  requiredQty: string;
  requiredBy: string | null;
  priority: string;
  reqStatus: string;
  notes: string | null;
  totalPhysical: string;
  usable: string;
  reservedForOthers: string;
  projectReserved: string;
  freeStock: string;
  incoming: string;
  expectedDate: string | null;
  poPipeline: string;
  openPr: string;
  issuedToSite: string;
  inTransit: string;
  receivedAtSite: string;
  siteStock: string;
  consumed: string;
  returned: string;
  damagedRejected: string;
  lastPurchaseRate: string | null;
  estimatedCost: string | null;
  preferredSupplier: { id: string; name: string } | null;
  reorderLevel: string | null;
} & MrpResult;

/**
 * Project-wise (or global, across accessible projects) material planning. Every figure is
 * aggregated in PostgreSQL from the ledger, balances, reservations, POs, requisitions,
 * challans and GRNs; nothing is computed from client data.
 */
export async function getMrp(actor: Actor, raw: unknown) {
  requirePermission(actor, "mrp.view");
  const q = mrpQuerySchema.parse(raw ?? {});
  if (q.projectId) await assertProjectVisible(actor, q.projectId);
  const where: Prisma.MaterialRequirementWhereInput = {
    organizationId: actor.organizationId,
    ...(q.view === "open" ? { status: "OPEN" } : {}),
    ...(q.projectId ? { projectId: q.projectId } : {}),
    project: { is: projectAccessWhere(actor) },
    ...(q.q ? { OR: [{ itemBrand: { item: { name: { contains: q.q, mode: "insensitive" } } } }, { itemBrand: { item: { code: { contains: q.q, mode: "insensitive" } } } }, { itemBrand: { brand: { name: { contains: q.q, mode: "insensitive" } } } }, { project: { code: { contains: q.q, mode: "insensitive" } } }] } : {}),
  };
  const reqs = await db.materialRequirement.findMany({
    where,
    orderBy: [{ requiredBy: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 2000,
    include: {
      project: { select: { id: true, code: true, name: true } },
      salesOrderLine: { select: { so: { select: { id: true, number: true } } } },
      itemBrand: { select: { id: true, currentQty: true, reorderLevel: true, lastPurchaseRate: true, preferredSupplier: { select: { id: true, name: true } }, item: { select: { id: true, code: true, name: true, unit: true } }, brand: { select: { id: true, name: true } } } },
    },
  });
  if (!reqs.length) return { rows: [] as MrpRow[], summary: summarize([]), query: q };

  const ibIds = [...new Set(reqs.map((r) => r.itemBrandId))];
  const [balances, reservations, pos, prs, siteMoves, challans, damaged, lastPo] = await Promise.all([
    db.$queryRaw<{ ib: string; type: string; project_id: string | null; qty: string }[]>`
      SELECT b.item_brand_id::text AS ib, l.type::text AS type, l.project_id::text AS project_id, SUM(b.on_hand)::text AS qty
      FROM stock_balances b JOIN stock_locations l ON l.id = b.location_id
      WHERE b.item_brand_id = ANY(${ibIds}::uuid[]) GROUP BY 1, 2, 3`,
    db.$queryRaw<{ ib: string; project_id: string; type: string; qty: string }[]>`
      SELECT r.item_brand_id::text AS ib, r.project_id::text AS project_id, l.type::text AS type, SUM(r.quantity - r.issued_qty)::text AS qty
      FROM stock_reservations r JOIN stock_locations l ON l.id = r.location_id
      WHERE r.status = 'ACTIVE' AND r.item_brand_id = ANY(${ibIds}::uuid[]) GROUP BY 1, 2, 3`,
    db.$queryRaw<{ ib: string; project_id: string | null; approved: boolean; qty: string; expected: Date | null }[]>`
      SELECT pl.item_brand_id::text AS ib, po.project_id::text AS project_id,
        (po.status IN ('APPROVED','SENT','ACKNOWLEDGED','PARTIALLY_RECEIVED')) AS approved,
        SUM(GREATEST(pl.quantity - pl.accepted_qty, 0))::text AS qty, MIN(po.expected_date) AS expected
      FROM po_lines pl JOIN purchase_orders po ON po.id = pl.po_id
      WHERE pl.item_brand_id = ANY(${ibIds}::uuid[]) AND po.status IN ('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACKNOWLEDGED','PARTIALLY_RECEIVED')
      GROUP BY 1, 2, 3`,
    db.$queryRaw<{ ib: string; project_id: string | null; qty: string }[]>`
      SELECT pl.item_brand_id::text AS ib, pr.project_id::text AS project_id, SUM(GREATEST(pl.quantity - pl.ordered_qty, 0))::text AS qty
      FROM pr_lines pl JOIN purchase_requisitions pr ON pr.id = pl.pr_id
      WHERE pl.item_brand_id = ANY(${ibIds}::uuid[]) AND pr.status IN ('DRAFT','SUBMITTED','APPROVED','PARTIALLY_ORDERED')
      GROUP BY 1, 2`,
    // Effective movement type: a reversal counts against the type it reversed.
    db.$queryRaw<{ ib: string; project_id: string; etype: string; qty: string }[]>`
      SELECT m.item_brand_id::text AS ib, l.project_id::text AS project_id, COALESCE(o.type, m.type)::text AS etype,
        SUM(CASE WHEN m.type = 'REVERSAL' THEN -m.quantity ELSE m.quantity END)::text AS qty
      FROM stock_transactions m
      JOIN stock_locations l ON l.id = m.location_id AND l.type = 'SITE'
      LEFT JOIN stock_transactions o ON o.id = m.reversal_of_id
      WHERE m.item_brand_id = ANY(${ibIds}::uuid[])
      GROUP BY 1, 2, 3`,
    db.$queryRaw<{ ib: string; project_id: string; issued: string; transit: string }[]>`
      SELECT cl.item_brand_id::text AS ib, l.project_id::text AS project_id,
        SUM(cl.quantity)::text AS issued, SUM(GREATEST(cl.quantity - cl.received_qty - cl.written_off_qty, 0))::text AS transit
      FROM challan_lines cl JOIN challans c ON c.id = cl.challan_id JOIN stock_locations l ON l.id = c.to_location_id AND l.type = 'SITE'
      WHERE cl.item_brand_id = ANY(${ibIds}::uuid[]) AND c.status IN ('DISPATCHED','PARTIALLY_RECEIVED','RECEIVED','CLOSED')
      GROUP BY 1, 2`,
    db.$queryRaw<{ ib: string; project_id: string; qty: string }[]>`
      SELECT gl.item_brand_id::text AS ib, g.project_id::text AS project_id, SUM(gl.damaged_qty + gl.rejected_qty)::text AS qty
      FROM grn_lines gl JOIN grns g ON g.id = gl.grn_id
      WHERE gl.item_brand_id = ANY(${ibIds}::uuid[]) AND g.status = 'POSTED' AND g.project_id IS NOT NULL
      GROUP BY 1, 2`,
    db.$queryRaw<{ ib: string; rate: string; party_id: string; party_name: string }[]>`
      SELECT DISTINCT ON (pl.item_brand_id) pl.item_brand_id::text AS ib, pl.rate::text AS rate, p.id::text AS party_id, p.name AS party_name
      FROM po_lines pl JOIN purchase_orders po ON po.id = pl.po_id JOIN parties p ON p.id = po.party_id
      WHERE pl.item_brand_id = ANY(${ibIds}::uuid[]) AND po.status NOT IN ('DRAFT','REJECTED','CANCELLED')
      ORDER BY pl.item_brand_id, po.order_date DESC, po.created_at DESC`,
  ]);

  const usable = new Map<Key, bigint>();
  const warehouse = new Map<Key, bigint>();
  const physical = new Map<Key, bigint>();
  const site = new Map<Key, bigint>();
  for (const b of balances) {
    const v = qtyUnits(b.qty);
    physical.set(b.ib, (physical.get(b.ib) ?? BigInt(0)) + v);
    if (b.type === "WAREHOUSE" || b.type === "SITE") usable.set(b.ib, (usable.get(b.ib) ?? BigInt(0)) + v);
    if (b.type === "WAREHOUSE") warehouse.set(b.ib, (warehouse.get(b.ib) ?? BigInt(0)) + v);
    if (b.type === "SITE" && b.project_id) site.set(k(b.ib, b.project_id), v);
  }
  const resAll = new Map<Key, bigint>();
  const resWarehouse = new Map<Key, bigint>();
  const resProj = new Map<Key, bigint>();
  for (const r of reservations) {
    const v = qtyUnits(r.qty);
    resAll.set(r.ib, (resAll.get(r.ib) ?? BigInt(0)) + v);
    if (r.type === "WAREHOUSE") resWarehouse.set(r.ib, (resWarehouse.get(r.ib) ?? BigInt(0)) + v);
    resProj.set(k(r.ib, r.project_id), (resProj.get(k(r.ib, r.project_id)) ?? BigInt(0)) + v);
  }
  const incoming = new Map<Key, { qty: bigint; expected: Date | null }>();
  const pipeline = new Map<Key, bigint>();
  for (const p of pos) {
    const key = k(p.ib, p.project_id);
    if (p.approved) incoming.set(key, { qty: qtyUnits(p.qty), expected: p.expected });
    else pipeline.set(key, qtyUnits(p.qty));
  }
  const openPr = new Map(prs.map((p) => [k(p.ib, p.project_id), qtyUnits(p.qty)]));
  const moves = new Map<Key, bigint>();
  for (const m of siteMoves) moves.set(k(m.ib, m.project_id, m.etype), qtyUnits(m.qty));
  const ch = new Map(challans.map((c) => [k(c.ib, c.project_id), c]));
  const dmg = new Map(damaged.map((d) => [k(d.ib, d.project_id), d.qty]));
  const last = new Map(lastPo.map((l) => [l.ib, l]));
  const today = startOfToday();
  const g = (m: Map<Key, bigint>, key: Key) => m.get(key) ?? BigInt(0);

  const rows: MrpRow[] = reqs.map((r) => {
    const ib = r.itemBrandId;
    const pk = k(ib, r.projectId);
    const mv = (t: string) => g(moves, k(ib, r.projectId, t));
    const receivedAtSite = mv("RECEIPT") + mv("TRANSFER_IN") + mv("INWARD") + mv("OPENING");
    const consumed = mv("CONSUMPTION");
    const returned = mv("TRANSFER_OUT") + mv("RETURN_TO_SUPPLIER");
    // Free (available-to-promise) = warehouse stock not reserved for any project. Stock at other
    // projects' sites belongs to them; this project's site stock already counts as fulfilled.
    const freeStock = g(warehouse, ib) - g(resWarehouse, ib);
    const reservedOthers = g(resAll, ib) - g(resProj, pk);
    const inc = incoming.get(pk);
    const rate = r.itemBrand.lastPurchaseRate ? dec4(r.itemBrand.lastPurchaseRate) : (last.get(ib)?.rate ?? null);
    const chal = ch.get(pk);
    const result = computeMrp({
      required: dec3(r.requiredQty),
      siteStock: fmtQty(g(site, pk)),
      inTransit: chal?.transit ?? "0",
      consumed: fmtQty(consumed),
      projectReserved: fmtQty(g(resProj, pk)),
      incoming: fmtQty(inc?.qty ?? BigInt(0)),
      poPipeline: fmtQty(g(pipeline, pk)),
      openPr: fmtQty(g(openPr, pk)),
      freeStock: fmtQty(freeStock),
      receivedAtSite: fmtQty(receivedAtSite),
      damagedRejected: dmg.get(pk) ?? "0",
      expectedDate: inc?.expected ?? null,
      requiredBy: r.requiredBy,
      usableCompany: fmtQty(g(usable, ib)),
      reorderLevel: r.itemBrand.reorderLevel ? dec3(r.itemBrand.reorderLevel) : null,
      today,
    });
    const lastRow = last.get(ib);
    return {
      requirementId: r.id,
      project: r.project,
      salesOrder: r.salesOrderLine?.so ?? null,
      itemBrandId: ib,
      item: r.itemBrand.item,
      brand: r.itemBrand.brand,
      requiredQty: dec3(r.requiredQty),
      requiredBy: r.requiredBy?.toISOString() ?? null,
      priority: r.priority,
      reqStatus: r.status,
      notes: r.notes,
      totalPhysical: fmtQty(g(physical, ib)),
      usable: fmtQty(g(usable, ib)),
      reservedForOthers: fmtQty(reservedOthers),
      projectReserved: fmtQty(g(resProj, pk)),
      freeStock: fmtQty(freeStock < BigInt(0) ? BigInt(0) : freeStock),
      incoming: fmtQty(inc?.qty ?? BigInt(0)),
      expectedDate: inc?.expected?.toISOString() ?? null,
      poPipeline: fmtQty(g(pipeline, pk)),
      openPr: fmtQty(g(openPr, pk)),
      issuedToSite: chal?.issued ?? "0",
      inTransit: chal?.transit ?? "0",
      receivedAtSite: fmtQty(receivedAtSite),
      siteStock: fmtQty(g(site, pk)),
      consumed: fmtQty(consumed),
      returned: fmtQty(returned),
      damagedRejected: dmg.get(pk) ?? "0",
      lastPurchaseRate: rate,
      estimatedCost: rate && cmpQty(result.toOrder, "0") > 0 ? qtyTimesRate(result.toOrder, rate) : null,
      preferredSupplier: r.itemBrand.preferredSupplier ?? (lastRow ? { id: lastRow.party_id, name: lastRow.party_name } : null),
      reorderLevel: r.itemBrand.reorderLevel ? dec3(r.itemBrand.reorderLevel) : null,
      ...result,
    };
  });
  const filtered = q.status ? rows.filter((r) => r.status === q.status || (r.flags as string[]).includes(q.status!)) : rows;
  return { rows: filtered, summary: summarize(rows), query: q };
}

function summarize(rows: MrpRow[]) {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    shortage: count("SHORTAGE") + count("LOW_STOCK"),
    toOrderLines: rows.filter((r) => cmpQty(r.toOrder, "0") > 0).length,
    awaiting: count("AWAITING_DELIVERY") + count("PARTIALLY_RECEIVED"),
    delayed: count("DELAYED"),
    alreadyOrdered: count("ALREADY_ORDERED"),
    fulfilled: count("FULLY_RECEIVED"),
    estimatedCost: addMoney(...rows.map((r) => r.estimatedCost ?? "0")),
    unpricedLines: rows.filter((r) => cmpQty(r.toOrder, "0") > 0 && !r.lastPurchaseRate).length,
  };
}

export function planningCapabilities(actor: Actor) {
  return { canManage: can(actor, "mrp.manage"), canReserve: can(actor, "stock.reserve"), canRaisePr: can(actor, "pr.create"), canRfq: can(actor, "rfq.manage"), canPo: can(actor, "po.create"), canTransfer: can(actor, "stock.transfer") };
}

// ─────────────────────────── Item planning attributes ───────────────────────────

const planningAttrSchema = z.object({
  reorderLevel: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim())).pipe(z.union([z.null(), z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Enter a quantity.")])),
  preferredSupplierId: uuid.optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
});

/** Reorder threshold and preferred supplier for an item–brand. */
export async function setPlanningAttributes(actor: Actor, itemBrandId: string, input: unknown) {
  requirePermission(actor, "items.manage");
  const data = parseInput(planningAttrSchema, input);
  const ib = await db.itemBrand.findFirst({ where: { id: itemBrandId, organizationId: actor.organizationId }, include: { item: { select: { code: true } }, brand: { select: { name: true } } } });
  if (!ib) throw new NotFoundError("Item–brand");
  if (data.preferredSupplierId) {
    const s = await db.party.findFirst({ where: { id: data.preferredSupplierId, organizationId: actor.organizationId, isSupplier: true } });
    if (!s) throw new ValidationError("Choose a supplier.", { preferredSupplierId: "Not a supplier." });
  }
  await db.$transaction(async (tx) => {
    await tx.itemBrand.update({ where: { id: itemBrandId }, data });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "item.planning_updated", entityType: "item", entityId: ib.itemId, summary: `Planning for ${ib.item.code} / ${ib.brand.name}: reorder level ${data.reorderLevel ?? "none"}` }, tx);
  });
}
