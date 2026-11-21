import "server-only";
import { writeAudit } from "@/lib/audit";
import { nextCode } from "@/lib/codes";
import { db, type Prisma } from "@/lib/db";
import { ConflictError, NotFoundError, isUniqueViolation } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions/definitions";
import { decOpt2, parseInput, requirePermission } from "@/modules/commercial/core";
import type { EntityAccess } from "@/modules/documents/access";
import { partyInputSchema, partyListQuerySchema } from "./validation";

/** Clients & suppliers. One record per legal party; a party may be both. */

export function partyCapabilities(actor: Actor) {
  return { canView: can(actor, "parties.view"), canManage: can(actor, "parties.manage") };
}

export async function listParties(actor: Actor, raw: unknown) {
  requirePermission(actor, "parties.view");
  const q = partyListQuerySchema.parse(raw ?? {});
  const and: Prisma.PartyWhereInput[] = [{ organizationId: actor.organizationId }];
  if (q.type === "client") and.push({ isClient: true });
  if (q.type === "supplier") and.push({ isSupplier: true });
  if (q.status) and.push({ status: q.status });
  if (q.q) and.push({ OR: [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }, { gstin: { contains: q.q, mode: "insensitive" } }, { city: { contains: q.q, mode: "insensitive" } }, { contactPerson: { contains: q.q, mode: "insensitive" } }] });
  const where: Prisma.PartyWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    db.party.count({ where }),
    db.party.findMany({ where, orderBy: [{ [q.sort]: q.dir }, { id: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, code: true, name: true, isClient: true, isSupplier: true, gstin: true, stateCode: true, city: true, phone: true, contactPerson: true, paymentTermsDays: true, status: true } }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize, query: q };
}

export type PartyOption = { id: string; code: string; name: string; gstin: string | null; stateCode: string | null; paymentTermsDays: number | null; tdsSection: string | null; tdsRate: string | null; status: string };

/** Pickers. Inactive parties are returned flagged so existing documents still display them. */
export async function partyOptions(actor: Actor, kind: "client" | "supplier" | "any"): Promise<PartyOption[]> {
  if (!can(actor, "parties.view") && !can(actor, "po.view") && !can(actor, "cpo.view") && !can(actor, "bills.view") && !can(actor, "payments.view") && !can(actor, "rfq.view") && !can(actor, "grn.view")) return [];
  const rows = await db.party.findMany({
    where: { organizationId: actor.organizationId, ...(kind === "client" ? { isClient: true } : kind === "supplier" ? { isSupplier: true } : {}) },
    orderBy: { name: "asc" },
    take: 3000,
    select: { id: true, code: true, name: true, gstin: true, stateCode: true, paymentTermsDays: true, tdsSection: true, tdsRate: true, status: true },
  });
  return rows.map((r) => ({ ...r, tdsRate: decOpt2(r.tdsRate) }));
}

export async function getParty(actor: Actor, id: string) {
  requirePermission(actor, "parties.view");
  const p = await db.party.findFirst({ where: { id, organizationId: actor.organizationId }, include: { createdBy: { select: { fullName: true } } } });
  if (!p) throw new NotFoundError("Party");
  return { ...p, creditLimit: decOpt2(p.creditLimit), tdsRate: decOpt2(p.tdsRate), capabilities: partyCapabilities(actor) };
}

async function assertNoDuplicate(organizationId: string, data: { name: string; gstin: string | null }, exceptId?: string) {
  const clash = await db.party.findFirst({
    where: { organizationId, ...(exceptId ? { id: { not: exceptId } } : {}), OR: [{ name: { equals: data.name, mode: "insensitive" } }, ...(data.gstin ? [{ gstin: data.gstin }] : [])] },
    select: { name: true, gstin: true, code: true },
  });
  if (!clash) return;
  if (data.gstin && clash.gstin === data.gstin) throw new ConflictError(`GSTIN already registered for ${clash.name} (${clash.code}).`, { gstin: `Already used by ${clash.name}.` });
  throw new ConflictError(`A party named "${clash.name}" already exists (${clash.code}).`, { name: "A party with this name already exists." });
}

const clashError = () => new ConflictError("A party with the same name or GSTIN already exists.", { name: "Duplicate name or GSTIN." });

export async function createParty(actor: Actor, input: unknown) {
  requirePermission(actor, "parties.manage");
  const data = parseInput(partyInputSchema, input);
  await assertNoDuplicate(actor.organizationId, data);
  try {
    return await db.$transaction(async (tx) => {
      const code = await nextCode(tx, actor.organizationId, "PARTY");
      const party = await tx.party.create({ data: { ...data, code, organizationId: actor.organizationId, createdById: actor.id } });
      await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "party.created", entityType: "party", entityId: party.id, summary: `Created ${[data.isClient && "client", data.isSupplier && "supplier"].filter(Boolean).join(" & ")} ${code} – ${party.name}` }, tx);
      return party;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw clashError();
    throw e;
  }
}

export async function updateParty(actor: Actor, id: string, input: unknown) {
  requirePermission(actor, "parties.manage");
  const data = parseInput(partyInputSchema, input);
  const before = await db.party.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!before) throw new NotFoundError("Party");
  await assertNoDuplicate(actor.organizationId, data, id);
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => String(before[k as keyof typeof before] ?? "") !== String(data[k] ?? ""));
  try {
    return await db.$transaction(async (tx) => {
      const party = await tx.party.update({ where: { id }, data });
      await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: before.status !== data.status ? (data.status === "ACTIVE" ? "party.activated" : "party.deactivated") : "party.updated", entityType: "party", entityId: id, summary: `Updated ${party.code} – ${party.name}${changed.length ? ` (${changed.join(", ")})` : ""}`, metadata: { changed } }, tx);
      return party;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw clashError();
    throw e;
  }
}

export async function partyAccess(actor: Actor, id: string): Promise<EntityAccess | null> {
  if (!can(actor, "parties.view")) return null;
  const p = await db.party.findFirst({ where: { id, organizationId: actor.organizationId }, select: { code: true, name: true } });
  if (!p) return null;
  return { projectId: null, label: `${p.code} – ${p.name}`, canView: true, canUpload: can(actor, "parties.manage"), locked: false };
}
