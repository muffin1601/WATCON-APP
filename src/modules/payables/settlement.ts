import "server-only";
import type { Tx } from "@/lib/db";
import { addMoney, cmpMoney, subMoney } from "@/lib/money";
import { dec2 } from "@/modules/commercial/core";

/**
 * Settlement bookkeeping shared by payments and credit/debit notes. Callers hold a row lock
 * on the document (SELECT … FOR UPDATE) before changing paid / adjusted amounts.
 */

export const outstandingOf = (net: string, paid: string, adjusted: string) => subMoney(net, addMoney(paid, adjusted));

export async function lockBill(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM supplier_bills WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.supplierBill.findUniqueOrThrow({ where: { id } });
}

export async function lockInvoice(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM client_invoices WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.clientInvoice.findUniqueOrThrow({ where: { id } });
}

export async function lockPayment(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
  return tx.payment.findUniqueOrThrow({ where: { id } });
}

/** Applies a delta to a bill's paid / adjusted amounts and derives APPROVED / PARTIALLY_PAID / PAID. */
export async function applyBillSettlement(tx: Tx, billId: string, delta: { paid?: string; adjusted?: string }) {
  const b = await lockBill(tx, billId);
  const paid = addMoney(dec2(b.paidAmount), delta.paid ?? "0");
  const adjusted = addMoney(dec2(b.adjustedAmount), delta.adjusted ?? "0");
  const settled = addMoney(paid, adjusted);
  const net = dec2(b.netPayable);
  const status = cmpMoney(settled, "0") <= 0 ? "APPROVED" : cmpMoney(settled, net) >= 0 ? "PAID" : "PARTIALLY_PAID";
  await tx.supplierBill.update({ where: { id: billId }, data: { paidAmount: paid, adjustedAmount: adjusted, status, version: { increment: 1 } } });
}

/** Same for client invoices; a linked running bill follows the invoice's payment state. */
export async function applyInvoiceSettlement(tx: Tx, invoiceId: string, delta: { received?: string; adjusted?: string }) {
  const inv = await lockInvoice(tx, invoiceId);
  const received = addMoney(dec2(inv.receivedAmount), delta.received ?? "0");
  const adjusted = addMoney(dec2(inv.adjustedAmount), delta.adjusted ?? "0");
  const settled = addMoney(received, adjusted);
  const net = dec2(inv.netReceivable);
  const status = cmpMoney(settled, "0") <= 0 ? "ISSUED" : cmpMoney(settled, net) >= 0 ? "PAID" : "PARTIALLY_PAID";
  await tx.clientInvoice.update({ where: { id: invoiceId }, data: { receivedAmount: received, adjustedAmount: adjusted, status, version: { increment: 1 } } });
  if (inv.raBillId) {
    const raStatus = status === "ISSUED" ? "INVOICED" : status;
    await tx.raBill.updateMany({ where: { id: inv.raBillId, status: { in: ["INVOICED", "PARTIALLY_PAID", "PAID"] } }, data: { status: raStatus, version: { increment: 1 } } });
  }
}
