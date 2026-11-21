import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { projectAccountsSummary, partyLedger } from "@/modules/insights/accounts";
import { listApprovals, listSoAmendmentRequests } from "@/modules/insights/approvals";
import { projectFinancials } from "@/modules/insights/finance";
import { runReport, toCsv } from "@/modules/insights/reports";
import { listProjectDocs, projectCommandCenter, projectDocCounts, projectOrderFlow } from "@/modules/insights/workspace";
import { createPo, poAction } from "@/modules/procurement/po";
import { createPr, prAction } from "@/modules/procurement/pr";
import { createGrn, postGrn } from "@/modules/stores/grn";
import { commercialFixture, day, errorOf, key, makeProject, type CFx } from "./commercial-helpers";

let fx: CFx;
beforeEach(async () => {
  fx = await commercialFixture();
});

const ver = async (model: "purchaseOrder" | "purchaseRequisition" | "grn", id: string) => ((await (db[model] as unknown as { findUniqueOrThrow: (a: object) => Promise<{ version: number }> }).findUniqueOrThrow({ where: { id } })).version);

async function approvedPo(projectId: string, qty = "50") {
  const po = await createPo(fx.roles.pu.actor, { projectId, partyId: fx.supplier.id, orderDate: day(), expectedDate: day(5), lines: [{ itemBrandId: fx.ibUltra.id, quantity: qty, rate: "380", gstRate: "28" }] });
  await poAction(fx.roles.pu.actor, po.id, "submit", { version: await ver("purchaseOrder", po.id) });
  await poAction(fx.actors.admin, po.id, "approve", { version: await ver("purchaseOrder", po.id) });
  return db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { lines: true } });
}

/** Money documents inserted directly: this suite tests the read side, independent of the billing services. */
async function seedMoney(projectId: string) {
  const org = fx.org.id;
  const by = fx.users.admin.id;
  await db.supplierBill.create({ data: { organizationId: org, number: `SB-${key().slice(0, 6)}`, partyId: fx.supplier.id, projectId, supplierInvoiceNo: "INV-1", invoiceKey: `INV1${key().slice(0, 4)}`, invoiceDate: new Date(`${day(-3)}T00:00:00Z`), dueDate: new Date(`${day(-1)}T00:00:00Z`), taxable: "19000", cgst: "2660", sgst: "2660", total: "24320", netPayable: "24320", paidAmount: "10000", status: "PARTIALLY_PAID", createdById: by } });
  await db.payment.create({ data: { organizationId: org, number: `PAY-${key().slice(0, 6)}`, direction: "OUT", partyId: fx.supplier.id, projectId, paymentDate: new Date(`${day(-1)}T00:00:00Z`), mode: "BANK_TRANSFER", amount: "10000", allocatedAmount: "10000", idempotencyKey: key(), createdById: by } });
  await db.clientInvoice.create({ data: { organizationId: org, number: `INV-${key().slice(0, 6)}`, projectId, partyId: fx.client.id, invoiceDate: new Date(`${day(-2)}T00:00:00Z`), dueDate: new Date(`${day(-1)}T00:00:00Z`), taxable: "30000", cgst: "2700", sgst: "2700", total: "35400", netReceivable: "35400", receivedAmount: "20000", status: "PARTIALLY_PAID", createdById: by } });
  await db.payment.create({ data: { organizationId: org, number: `RCPT-${key().slice(0, 6)}`, direction: "IN", partyId: fx.client.id, projectId, paymentDate: new Date(`${day(-1)}T00:00:00Z`), mode: "UPI", amount: "20000", allocatedAmount: "20000", idempotencyKey: key(), createdById: by } });
}

describe("project workspace & insights", () => {
  it("computes project financial KPIs from approved documents", async () => {
    const po = await approvedPo(fx.p1.id);
    const g = await createGrn(fx.roles.se.actor, { clientKey: key(), poId: po.id, receiptDate: day(), submit: true, lines: [{ poLineId: po.lines[0]!.id, receivedQty: "50" }] });
    await postGrn(fx.roles.sk.actor, g.id, await ver("grn", g.id));
    await seedMoney(fx.p1.id);
    // Draft PO must not count as committed.
    await createPo(fx.roles.pu.actor, { projectId: fx.p1.id, partyId: fx.supplier.id, orderDate: day(), lines: [{ itemBrandId: fx.ibUltra.id, quantity: "5", rate: "100", gstRate: "28" }] });

    const f = (await projectFinancials(fx.org.id, [fx.p1.id])).get(fx.p1.id)!;
    expect(f.committed).toBe("24320.00");
    expect(f.receivedValue).toBe("19000.00");
    expect(f.supplierBilled).toBe("24320.00");
    expect(f.paid).toBe("10000.00");
    expect(f.payable).toBe("14320.00");
    expect(f.billed).toBe("35400.00");
    expect(f.received).toBe("20000.00");
    expect(f.receivable).toBe("15400.00");
    expect(f.materialCost).toBe("19000.00");
    expect(f.margin).toBe("11000.00");
    expect(f.marginPct).toBe("36.67");

    const cc = await projectCommandCenter(fx.roles.pm.actor, fx.p1.id);
    expect(cc.financials?.receivable).toBe("15400.00");
    expect(cc.attention.some((a) => a.title.startsWith("Payment overdue"))).toBe(true);

    const ledger = await partyLedger(fx.roles.ac.actor, { partyId: fx.supplier.id });
    expect(ledger.closing).toBe("-14320.00");
    const clientLedger = await partyLedger(fx.roles.ac.actor, { partyId: fx.client.id });
    expect(clientLedger.closing).toBe("15400.00");
  });

  it("never shows another project's records", async () => {
    const p3 = await makeProject(fx.org.id, fx.users.admin.id);
    await approvedPo(fx.p1.id);
    const pr3 = await createPr(fx.actors.admin, { projectId: p3.id, lines: [{ itemBrandId: fx.ibAcc.id, quantity: "5" }] });
    await prAction(fx.actors.admin, pr3.id, "submit", { version: await ver("purchaseRequisition", pr3.id) });
    await seedMoney(p3.id);

    // Outsider: the project itself is invisible → 404, not an empty list.
    expect((await errorOf(listProjectDocs(fx.roles.outsider.actor, fx.p1.id, "po"))).code).toBe("NOT_FOUND");
    expect((await errorOf(projectCommandCenter(fx.roles.outsider.actor, fx.p1.id))).code).toBe("NOT_FOUND");

    // PM manages p1/p2 only.
    const summary = await projectAccountsSummary(fx.roles.pm.actor);
    expect(summary.rows.map((r) => r.project.id)).not.toContain(p3.id);
    expect((await listApprovals(fx.roles.pm.actor)).map((a) => a.id)).not.toContain(pr3.id);
    const report = await runReport(fx.roles.pm.actor, "po-register", {});
    expect(report.rows).toHaveLength(1);
    const ledger = await partyLedger(fx.roles.pm.actor, { partyId: fx.client.id });
    expect(ledger.entries.every((e) => e.project !== p3.code)).toBe(true);

    // No commercial-report permission → forbidden.
    expect((await errorOf(runReport(fx.roles.se.actor, "po-register", {}))).code).toBe("FORBIDDEN");
  });

  it("approvals inbox separates own documents from actionable ones", async () => {
    const own = await createPr(fx.roles.pm.actor, { projectId: fx.p1.id, lines: [{ itemBrandId: fx.ibUltra.id, quantity: "3" }] });
    await prAction(fx.roles.pm.actor, own.id, "submit", { version: await ver("purchaseRequisition", own.id) });
    const theirs = await createPr(fx.roles.se.actor, { projectId: fx.p1.id, lines: [{ itemBrandId: fx.ibUltra.id, quantity: "4" }] });
    await prAction(fx.roles.se.actor, theirs.id, "submit", { version: await ver("purchaseRequisition", theirs.id) });

    const items = await listApprovals(fx.roles.pm.actor);
    const mine = items.find((i) => i.id === own.id)!;
    const other = items.find((i) => i.id === theirs.id)!;
    expect(mine.mine).toBe(false);
    expect(mine.blockedReason).toMatch(/another approver/);
    expect(other.mine).toBe(true);
    expect(other.href).toBe(`/purchase-requisitions/${theirs.id}`);
    // Users without an approving permission see nothing.
    expect(await listApprovals(fx.roles.se.actor)).toEqual([]);
    // Amendment requests degrade gracefully whether or not the table exists yet.
    expect(Array.isArray(await listSoAmendmentRequests(fx.actors.superAdmin))).toBe(true);
  });

  it("lists, filters and counts project documents and guides the order flow", async () => {
    const po = await approvedPo(fx.p1.id);
    await createPo(fx.roles.pu.actor, { projectId: fx.p1.id, partyId: fx.supplier2.id, orderDate: day(), lines: [{ itemBrandId: fx.ibAcc.id, quantity: "2", rate: "10", gstRate: "28" }] });
    const all = await listProjectDocs(fx.roles.pm.actor, fx.p1.id, "po");
    expect(all.total).toBe(2);
    expect((await listProjectDocs(fx.roles.pm.actor, fx.p1.id, "po", { q: po.number })).total).toBe(1);
    expect((await listProjectDocs(fx.roles.pm.actor, fx.p1.id, "po", { q: "Balaji" })).total).toBe(1);
    expect((await listProjectDocs(fx.roles.pm.actor, fx.p1.id, "po", { status: "DRAFT" })).total).toBe(1);
    expect((await listProjectDocs(fx.roles.pm.actor, fx.p1.id, "po", { status: "NOT_A_STATUS" })).total).toBe(2);
    expect((await listProjectDocs(fx.roles.pm.actor, fx.p2.id, "po")).total).toBe(0);

    const counts = await projectDocCounts(fx.roles.pm.actor, fx.p1.id);
    expect(counts.po).toEqual({ total: 2, pending: 0, pendingLabel: "awaiting approval" });

    const flow = await projectOrderFlow(fx.roles.pm.actor, fx.p1.id);
    expect(flow.map((s) => s.key)).toEqual(["so", "planning", "pr", "po", "grn", "delivery", "billing"]);
    expect(flow[0]!.action).toEqual({ label: "Create sales order", href: `/sales-orders/new?projectId=${fx.p1.id}` });
    expect(flow[3]!.state).toBe("active");
  });

  it("exports CSV safely", () => {
    const csv = toCsv([{ key: "a", label: "Name", type: "text" }, { key: "b", label: "Amount", type: "money" }], [{ a: '=HYPERLINK("x")', b: "-120.50" }, { a: "Shree, Traders", b: null }]);
    expect(csv.split("\r\n")).toEqual(["Name,Amount", `"'=HYPERLINK(""x"")",-120.50`, '"Shree, Traders",']);
  });
});
