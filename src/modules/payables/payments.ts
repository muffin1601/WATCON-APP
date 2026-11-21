import "server-only";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { db, type Prisma, type Tx } from "@/lib/db";
import { nextDocNumber } from "@/lib/doc-numbering";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { addMoney, cmpMoney, formatINR, subMoney } from "@/lib/money";
import { can, type Actor } from "@/lib/permissions/definitions";
import { dateString, optionalText, toDbDate, uuid } from "@/lib/validations/common";
import { assertProjectUsable, dec2, parseInput, projectRequiredScoped, projectScoped, requirePermission } from "@/modules/commercial/core";
import { moneyField, optMoney, projectIdField } from "@/modules/commercial/pricing";
import type { EntityAccess } from "@/modules/documents/access";
import { applyBillSettlement, applyInvoiceSettlement, lockBill, lockInvoice, lockPayment, outstandingOf } from "./settlement";

/**
 * Supplier payments (OUT) and client receipts (IN). A payment is posted once; what is not
 * allocated to bills / invoices is an advance that can be allocated later. Allocations are
 * reversed (never deleted); cancelling a payment reverses all of its allocations.
 */

export const PAYMENT_MODES = ["BANK_TRANSFER", "CHEQUE", "UPI", "CASH", "CARD", "OTHER"] as const;
export const PAYMENT_MODE_LABELS: Record<(typeof PAYMENT_MODES)[number], string> = { BANK_TRANSFER: "Bank transfer (NEFT/RTGS/IMPS)", CHEQUE: "Cheque", UPI: "UPI", CASH: "Cash", CARD: "Card", OTHER: "Other" };

const allocationSchema = z.object({ documentId: uuid, amount: moneyField.refine((v) => Number(v) > 0, "Must be greater than zero.") });

export const paymentSchema = z.object({
  direction: z.enum(["OUT", "IN"]),
  partyId: uuid,
  projectId: projectIdField,
  paymentDate: dateString,
  mode: z.enum(PAYMENT_MODES),
  reference: optionalText("Reference", 100),
  bankAccount: optionalText("Bank account", 100),
  amount: optMoney,
  tdsAmount: optMoney,
  remarks: optionalText("Remarks", 1000),
  idempotencyKey: z.string().trim().min(8).max(100),
  allocations: z.array(allocationSchema).max(200).default([]),
});
export type PaymentInput = z.input<typeof paymentSchema>;

type PaymentRow = Awaited<ReturnType<typeof lockPayment>>;
const unallocatedOf = (p: Pick<PaymentRow, "amount" | "tdsAmount" | "allocatedAmount">) => subMoney(addMoney(dec2(p.amount), dec2(p.tdsAmount)), dec2(p.allocatedAmount));

/** Allocates part of a payment to one bill (OUT) or invoice (IN). Locks payment, then the document. */
async function allocateTx(tx: Tx, actor: Actor, paymentId: string, documentId: string, amount: string) {
  const p = await lockPayment(tx, paymentId);
  if (p.status !== "POSTED") throw new ValidationError("This payment is cancelled.");
  const free = unallocatedOf(p);
  if (cmpMoney(amount, free) > 0) throw new ValidationError(`Only ${formatINR(free)} of this ${p.direction === "OUT" ? "payment" : "receipt"} is unallocated.`, { amount: `Maximum ${formatINR(free)}.` });
  let label: string;
  if (p.direction === "OUT") {
    const visible = await tx.supplierBill.findFirst({ where: { AND: [{ id: documentId }, projectScoped(actor) as Prisma.SupplierBillWhereInput] }, select: { id: true } });
    if (!visible) throw new ValidationError("Supplier bill not found.");
    const b = await lockBill(tx, documentId);
    if (b.partyId !== p.partyId) throw new ValidationError(`Bill ${b.number} belongs to a different supplier.`);
    if (b.projectId !== p.projectId) throw new ValidationError(`Bill ${b.number} belongs to a different project. A payment can only settle bills of its own project.`);
    if (!["APPROVED", "PARTIALLY_PAID"].includes(b.status)) throw new ValidationError(`Bill ${b.number} is not approved for payment (or is already paid).`);
    const due = outstandingOf(dec2(b.netPayable), dec2(b.paidAmount), dec2(b.adjustedAmount));
    if (cmpMoney(amount, due) > 0) throw new ValidationError(`Bill ${b.number} has only ${formatINR(due)} outstanding.`, { amount: `Maximum ${formatINR(due)}.` });
    await tx.paymentAllocation.create({ data: { organizationId: actor.organizationId, paymentId, supplierBillId: b.id, amount, allocatedById: actor.id } });
    await applyBillSettlement(tx, b.id, { paid: amount });
    label = b.number;
  } else {
    const visible = await tx.clientInvoice.findFirst({ where: { AND: [{ id: documentId }, projectRequiredScoped(actor) as Prisma.ClientInvoiceWhereInput] }, select: { id: true } });
    if (!visible) throw new ValidationError("Client invoice not found.");
    const inv = await lockInvoice(tx, documentId);
    if (inv.partyId !== p.partyId) throw new ValidationError(`Invoice ${inv.number} belongs to a different client.`);
    if (inv.projectId !== p.projectId) throw new ValidationError(`Invoice ${inv.number} belongs to a different project. A receipt can only settle invoices of its own project.`);
    if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status)) throw new ValidationError(`Invoice ${inv.number} is not issued (or is already paid).`);
    const due = outstandingOf(dec2(inv.netReceivable), dec2(inv.receivedAmount), dec2(inv.adjustedAmount));
    if (cmpMoney(amount, due) > 0) throw new ValidationError(`Invoice ${inv.number} has only ${formatINR(due)} outstanding.`, { amount: `Maximum ${formatINR(due)}.` });
    await tx.paymentAllocation.create({ data: { organizationId: actor.organizationId, paymentId, clientInvoiceId: inv.id, amount, allocatedById: actor.id } });
    await applyInvoiceSettlement(tx, inv.id, { received: amount });
    label = inv.number;
  }
  await tx.payment.update({ where: { id: paymentId }, data: { allocatedAmount: addMoney(dec2(p.allocatedAmount), amount), version: { increment: 1 } } });
  return label;
}

export async function createPayment(actor: Actor, input: unknown) {
  requirePermission(actor, "payments.manage");
  const data = parseInput(paymentSchema, input);
  const existing = await db.payment.findUnique({ where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: data.idempotencyKey } } });
  if (existing) return existing;
  if (data.direction === "OUT" && cmpMoney(data.tdsAmount, "0") > 0) throw new ValidationError("TDS on supplier payments is deducted on the bill, not here.", { tdsAmount: "Not used for supplier payments." });
  const gross = addMoney(data.amount, data.tdsAmount);
  if (cmpMoney(gross, "0") <= 0) throw new ValidationError("Enter the amount.", { amount: "Must be greater than zero." });
  const allocated = addMoney(...data.allocations.map((a) => a.amount));
  if (cmpMoney(allocated, gross) > 0) throw new ValidationError(`You have allocated ${formatINR(allocated)}, more than the ${formatINR(gross)} ${data.direction === "OUT" ? "paid" : "received"}.`, { allocations: "Allocated more than the amount." });
  if (new Set(data.allocations.map((a) => a.documentId)).size !== data.allocations.length) throw new ValidationError("Each document can appear only once.", { allocations: "Duplicate document." });
  const party = await db.party.findFirst({ where: { id: data.partyId, organizationId: actor.organizationId } });
  if (!party || (data.direction === "OUT" ? !party.isSupplier : !party.isClient)) throw new ValidationError(data.direction === "OUT" ? "Choose a supplier." : "Choose a client.", { partyId: "Wrong party type." });
  const projectId = data.projectId;
  await assertProjectUsable(actor, projectId);
  try {
    return await db.$transaction(async (tx) => {
      const date = toDbDate(data.paymentDate)!;
      const number = await nextDocNumber(tx, actor.organizationId, data.direction === "OUT" ? "PAY" : "RCPT", date);
      const p = await tx.payment.create({
        data: { organizationId: actor.organizationId, number, direction: data.direction, partyId: party.id, projectId, paymentDate: date, mode: data.mode, reference: data.reference, bankAccount: data.bankAccount, amount: data.amount, tdsAmount: data.tdsAmount, remarks: data.remarks, idempotencyKey: data.idempotencyKey, createdById: actor.id },
      });
      const labels: string[] = [];
      for (const a of data.allocations) labels.push(await allocateTx(tx, actor, p.id, a.documentId, a.amount));
      const advance = subMoney(gross, allocated);
      await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: data.direction === "OUT" ? "payment.made" : "payment.received", entityType: "payment", entityId: p.id, projectId, summary: `${data.direction === "OUT" ? "Paid" : "Received"} ${formatINR(gross)} ${data.direction === "OUT" ? "to" : "from"} ${party.name} (${number})${labels.length ? ` against ${labels.join(", ")}` : ""}${cmpMoney(advance, "0") > 0 ? ` · advance ${formatINR(advance)}` : ""}` }, tx);
      return tx.payment.findUniqueOrThrow({ where: { id: p.id } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const again = await db.payment.findUnique({ where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: data.idempotencyKey } } });
      if (again) return again;
    }
    throw e;
  }
}

async function loadScoped(actor: Actor, id: string) {
  const p = await db.payment.findFirst({ where: { AND: [{ id }, projectScoped(actor) as Prisma.PaymentWhereInput] } });
  if (!p) throw new NotFoundError("Payment");
  return p;
}

export async function allocatePayment(actor: Actor, paymentId: string, input: unknown) {
  requirePermission(actor, "payments.manage");
  const data = parseInput(allocationSchema, input);
  const p = await loadScoped(actor, paymentId);
  return db.$transaction(async (tx) => {
    const label = await allocateTx(tx, actor, p.id, data.documentId, data.amount);
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "payment.allocated", entityType: "payment", entityId: p.id, projectId: p.projectId, summary: `Allocated ${formatINR(data.amount)} of ${p.number} to ${label}` }, tx);
  });
}

async function reverseTx(tx: Tx, actor: Actor, allocationId: string, reason: string) {
  const a = await tx.paymentAllocation.findUniqueOrThrow({ where: { id: allocationId } });
  const p = await lockPayment(tx, a.paymentId);
  const res = await tx.paymentAllocation.updateMany({ where: { id: allocationId, reversedAt: null }, data: { reversedAt: new Date(), reversedById: actor.id, reverseReason: reason } });
  if (res.count !== 1) throw new ConflictError("This allocation was already reversed.");
  const amt = dec2(a.amount);
  if (a.supplierBillId) await applyBillSettlement(tx, a.supplierBillId, { paid: `-${amt}` });
  if (a.clientInvoiceId) await applyInvoiceSettlement(tx, a.clientInvoiceId, { received: `-${amt}` });
  await tx.payment.update({ where: { id: p.id }, data: { allocatedAmount: subMoney(dec2(p.allocatedAmount), amt), version: { increment: 1 } } });
  return amt;
}

export async function reverseAllocation(actor: Actor, allocationId: string, reason: string | null | undefined) {
  requirePermission(actor, "payments.manage");
  if (!reason?.trim()) throw new ValidationError("Give a reason for reversing.", { note: "Reason required." });
  const a = await db.paymentAllocation.findFirst({ where: { id: allocationId, organizationId: actor.organizationId }, include: { payment: { select: { id: true } } } });
  if (!a) throw new NotFoundError("Allocation");
  const p = await loadScoped(actor, a.payment.id);
  return db.$transaction(async (tx) => {
    const amt = await reverseTx(tx, actor, allocationId, reason.trim());
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "payment.allocation_reversed", entityType: "payment", entityId: p.id, projectId: p.projectId, summary: `Reversed allocation of ${formatINR(amt)} on ${p.number} – ${reason.trim()}` }, tx);
  });
}

export async function cancelPayment(actor: Actor, id: string, version: number, reason: string | null | undefined) {
  requirePermission(actor, "payments.manage");
  if (!reason?.trim()) throw new ValidationError("Give a reason for cancelling.", { note: "Reason required." });
  const p = await loadScoped(actor, id);
  return db.$transaction(async (tx) => {
    const locked = await lockPayment(tx, id);
    if (locked.status !== "POSTED" || locked.version !== version) throw new ConflictError("This payment was changed by someone else or is already cancelled. Reload and try again.");
    const active = await tx.paymentAllocation.findMany({ where: { paymentId: id, reversedAt: null } });
    for (const a of active) await reverseTx(tx, actor, a.id, `Payment cancelled: ${reason.trim()}`);
    await tx.payment.update({ where: { id }, data: { status: "CANCELLED", cancelledById: actor.id, cancelledAt: new Date(), cancelReason: reason.trim(), version: { increment: 1 } } });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "payment.cancelled", entityType: "payment", entityId: id, projectId: p.projectId, summary: `Cancelled ${p.number} (${formatINR(addMoney(dec2(p.amount), dec2(p.tdsAmount)))})${active.length ? `, reversed ${active.length} allocation(s)` : ""} – ${reason.trim()}` }, tx);
  });
}

// ─────────────────────────── Queries ───────────────────────────

export const paymentListQuerySchema = z.object({
  direction: z.enum(["OUT", "IN"]).catch("OUT").default("OUT"),
  q: z.string().trim().max(100).optional().catch(undefined),
  projectId: uuid.optional().catch(undefined),
  partyId: uuid.optional().catch(undefined),
  advances: z.enum(["1"]).optional().catch(undefined),
  status: z.enum(["POSTED", "CANCELLED"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).catch(20).default(20),
});

export async function listPayments(actor: Actor, raw: unknown) {
  requirePermission(actor, "payments.view");
  const q = paymentListQuerySchema.parse(raw ?? {});
  const base: Prisma.PaymentWhereInput = { AND: [projectScoped(actor) as Prisma.PaymentWhereInput, { direction: q.direction }, q.projectId ? { projectId: q.projectId } : {}, q.partyId ? { partyId: q.partyId } : {}] };
  const where: Prisma.PaymentWhereInput = {
    AND: [base, q.status ? { status: q.status } : {}, q.q ? { OR: [{ number: { contains: q.q, mode: "insensitive" } }, { reference: { contains: q.q, mode: "insensitive" } }, { party: { name: { contains: q.q, mode: "insensitive" } } }] } : {}],
  };
  const rows = await db.payment.findMany({ where, orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }], take: 2000, include: { party: { select: { id: true, name: true } }, project: { select: { id: true, code: true } } } });
  const mapped = rows.map((r) => ({ id: r.id, number: r.number, direction: r.direction, paymentDate: r.paymentDate.toISOString(), mode: r.mode, reference: r.reference, amount: dec2(r.amount), tdsAmount: dec2(r.tdsAmount), gross: addMoney(dec2(r.amount), dec2(r.tdsAmount)), allocated: dec2(r.allocatedAmount), unallocated: r.status === "POSTED" ? unallocatedOf(r) : "0.00", status: r.status, party: r.party, project: r.project }));
  const filtered = q.advances ? mapped.filter((r) => cmpMoney(r.unallocated, "0") > 0) : mapped;
  const totals = await db.payment.aggregate({ where: { AND: [base, { status: "POSTED" }] }, _sum: { amount: true, tdsAmount: true, allocatedAmount: true }, _count: true });
  const advance = subMoney(addMoney(dec2(totals._sum.amount), dec2(totals._sum.tdsAmount)), dec2(totals._sum.allocatedAmount));
  const advanceCount = mapped.filter((r) => cmpMoney(r.unallocated, "0") > 0).length;
  return {
    total: filtered.length,
    page: q.page,
    pageSize: q.pageSize,
    query: q,
    rows: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    summary: { count: totals._count, gross: addMoney(dec2(totals._sum.amount), dec2(totals._sum.tdsAmount)), advance, advanceCount },
  };
}

export async function getPayment(actor: Actor, id: string) {
  requirePermission(actor, "payments.view");
  const p = await db.payment.findFirst({
    where: { AND: [{ id }, projectScoped(actor) as Prisma.PaymentWhereInput] },
    include: {
      party: { select: { id: true, code: true, name: true, gstin: true, stateCode: true, address: true, city: true, phone: true, email: true, whatsappNumber: true } },
      project: { select: { id: true, code: true, name: true } },
      createdBy: { select: { fullName: true } },
      cancelledBy: { select: { fullName: true } },
      allocations: { orderBy: { allocatedAt: "asc" }, include: { supplierBill: { select: { id: true, number: true, supplierInvoiceNo: true } }, clientInvoice: { select: { id: true, number: true } }, allocatedBy: { select: { fullName: true } }, reversedBy: { select: { fullName: true } } } },
    },
  });
  if (!p) throw new NotFoundError("Payment");
  const unallocated = p.status === "POSTED" ? unallocatedOf(p) : "0.00";
  return {
    payment: { ...p, amount: dec2(p.amount), tdsAmount: dec2(p.tdsAmount), allocatedAmount: dec2(p.allocatedAmount), gross: addMoney(dec2(p.amount), dec2(p.tdsAmount)), allocations: p.allocations.map((a) => ({ ...a, amount: dec2(a.amount) })) },
    unallocated,
    can: {
      allocate: can(actor, "payments.manage") && p.status === "POSTED" && cmpMoney(unallocated, "0") > 0,
      reverse: can(actor, "payments.manage") && p.status === "POSTED",
      cancel: can(actor, "payments.manage") && p.status === "POSTED",
    },
  };
}

export async function paymentAccess(actor: Actor, id: string): Promise<EntityAccess | null> {
  if (!can(actor, "payments.view")) return null;
  const p = await db.payment.findFirst({ where: { AND: [{ id }, projectScoped(actor) as Prisma.PaymentWhereInput] }, select: { number: true, projectId: true, status: true } });
  if (!p) return null;
  return { projectId: p.projectId, label: p.number, canView: true, canUpload: can(actor, "payments.manage"), locked: p.status === "CANCELLED" };
}

/** Open (issued, unpaid) invoices of a client, oldest due first — for the receipt form. */
export async function outstandingInvoices(actor: Actor, partyId: string, projectId?: string | null) {
  requirePermission(actor, "payments.view");
  const rows = await db.clientInvoice.findMany({
    where: { AND: [projectRequiredScoped(actor) as Prisma.ClientInvoiceWhereInput, { partyId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, projectId ? { projectId } : {}] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { invoiceDate: "asc" }],
    select: { id: true, number: true, invoiceDate: true, dueDate: true, netReceivable: true, receivedAmount: true, adjustedAmount: true, project: { select: { code: true } } },
  });
  return rows.map((r) => ({ id: r.id, number: r.number, ref: null as string | null, date: r.invoiceDate.toISOString(), dueDate: r.dueDate?.toISOString() ?? null, net: dec2(r.netReceivable), outstanding: outstandingOf(dec2(r.netReceivable), dec2(r.receivedAmount), dec2(r.adjustedAmount)), project: r.project.code })).filter((r) => cmpMoney(r.outstanding, "0") > 0);
}

/** Party + project of the bill / invoice a payment form was opened from (null when not visible). */
export async function paymentDefaultsFor(actor: Actor, direction: "OUT" | "IN", documentId: string) {
  requirePermission(actor, "payments.manage");
  return direction === "OUT"
    ? db.supplierBill.findFirst({ where: { AND: [{ id: documentId }, projectScoped(actor) as Prisma.SupplierBillWhereInput] }, select: { partyId: true, projectId: true } })
    : db.clientInvoice.findFirst({ where: { AND: [{ id: documentId }, projectRequiredScoped(actor) as Prisma.ClientInvoiceWhereInput] }, select: { partyId: true, projectId: true } });
}
