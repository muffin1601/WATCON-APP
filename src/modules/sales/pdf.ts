import "server-only";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { stateName } from "@/lib/gst";
import { amountInWords, formatINR } from "@/lib/money";
import type { Actor } from "@/lib/permissions/definitions";
import type { PdfDoc } from "@/components/documents/commercial-pdf";
import { getCommercialSettings } from "@/modules/commercial/core";
import { getClientPo } from "./client-po";
import { getClientInvoice } from "./invoice";
import { getRaBill } from "./ra-bill";
import { getSalesOrder } from "./sales-order";

const rs = (v: string | null | undefined) => formatINR(v, { symbol: false }).replace(/^-?/, (m) => `${m}Rs. `);
const q = (v: string) => (v.includes(".") ? v.replace(/\.?0+$/, "") : v);
const human = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const partyBlock = (label: string, p: { name: string; address: string | null; city: string | null; gstin: string | null; stateCode: string | null; phone: string | null }) => ({ label, name: p.name, address: [p.address, p.city].filter(Boolean).join(", ") || null, gstin: p.gstin, state: p.stateCode ? `${p.stateCode} – ${stateName(p.stateCode)}` : null, phone: p.phone });

async function orgHeader(actor: Actor): Promise<PdfDoc["org"]> {
  const [org, settings] = await Promise.all([db.organization.findUniqueOrThrow({ where: { id: actor.organizationId } }), getCommercialSettings(actor.organizationId)]);
  return { name: org.name, legalName: org.legalName, address: org.address, phone: org.phone, email: org.email, gstin: settings.gstin, logoDataUrl: org.logoDataUrl };
}

const priced = [
  { key: "n", label: "#", w: "4%" },
  { key: "item", label: "Description", w: "38%" },
  { key: "hsn", label: "HSN/SAC", w: "9%" },
  { key: "qty", label: "Qty", w: "11%", align: "right" as const },
  { key: "rate", label: "Rate", w: "11%", align: "right" as const },
  { key: "gst", label: "GST%", w: "7%", align: "right" as const },
  { key: "amt", label: "Amount", w: "20%", align: "right" as const },
];

export async function clientPoPdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { cpo } = await getClientPo(actor, id);
  return {
    title: "Client Purchase Order (Contract)",
    number: `${cpo.number}${cpo.revision ? ` (Rev ${cpo.revision})` : ""}`,
    date: formatDate(cpo.poDate),
    status: human(cpo.status),
    org: await orgHeader(actor),
    party: partyBlock("Client", cpo.party),
    meta: [
      { label: "Client PO no.", value: cpo.clientPoNumber },
      { label: "Project", value: `${cpo.project.code} – ${cpo.project.name}` },
      { label: "Period", value: `${formatDate(cpo.startDate)} → ${formatDate(cpo.endDate)}` },
      { label: "Retention", value: `${q(cpo.retentionPct)}%` },
      { label: "Advance", value: `${rs(cpo.advanceAmount)} (recovery ${q(cpo.advanceRecoveryPct)}%)` },
      { label: "Payment terms", value: cpo.paymentTerms ?? "—" },
    ],
    columns: priced,
    rows: cpo.lines.map((l) => ({ n: String(l.lineNo), item: `${l.boqRef ? `${l.boqRef} – ` : ""}${l.description}`, hsn: l.hsnSac ?? "", qty: `${q(l.quantity)} ${l.unit}`, rate: rs(l.rate).replace("Rs. ", ""), gst: q(l.gstRate), amt: rs(l.total) })),
    totals: [{ label: "Taxable value", value: rs(cpo.taxable) }, { label: "GST", value: rs(cpo.taxAmount) }, { label: "Contract value", value: rs(cpo.total), strong: true }],
    amountInWords: amountInWords(cpo.total),
    notes: [...(cpo.scope ? [{ label: "Scope", value: cpo.scope }] : []), ...(cpo.notes ? [{ label: "Notes", value: cpo.notes }] : [])],
    signatures: ["Prepared by", "Approved by"],
  };
}

export async function salesOrderPdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { so } = await getSalesOrder(actor, id);
  return {
    title: "Sales Order",
    number: `${so.number}${so.revision ? ` (Rev ${so.revision})` : ""}`,
    date: formatDate(so.orderDate),
    status: human(so.status),
    org: await orgHeader(actor),
    party: partyBlock("Client", so.party),
    meta: [
      { label: "Project", value: `${so.project.code} – ${so.project.name}` },
      ...(so.clientPo ? [{ label: "Client PO", value: `${so.clientPo.clientPoNumber} (${so.clientPo.number})` }] : []),
      { label: "Delivery by", value: formatDate(so.deliveryDate) },
      { label: "Deliver to", value: so.deliveryAddress ?? so.project.siteAddress },
      { label: "Payment terms", value: so.paymentTerms ?? "—" },
    ],
    columns: priced,
    rows: so.lines.map((l) => ({ n: String(l.lineNo), item: l.description, hsn: l.hsnSac ?? "", qty: `${q(l.quantity)} ${l.unit}`, rate: rs(l.rate).replace("Rs. ", ""), gst: q(l.gstRate), amt: rs(l.total) })),
    totals: [{ label: "Taxable value", value: rs(so.taxable) }, { label: "GST", value: rs(so.taxAmount) }, { label: "Total", value: rs(so.total), strong: true }],
    amountInWords: amountInWords(so.total),
    notes: [...(so.deliverySchedule ? [{ label: "Delivery schedule", value: so.deliverySchedule }] : []), ...(so.billingSchedule ? [{ label: "Billing schedule", value: so.billingSchedule }] : []), ...(so.notes ? [{ label: "Notes", value: so.notes }] : [])],
    signatures: ["Prepared by", "Approved by", "Client acceptance"],
  };
}

export async function raBillPdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { bill } = await getRaBill(actor, id);
  return {
    title: `Running Account Bill – RA-${bill.raNumber}`,
    number: bill.number,
    date: formatDate(bill.billDate),
    status: human(bill.status),
    org: await orgHeader(actor),
    party: partyBlock("Client", bill.party),
    meta: [
      { label: "Project", value: `${bill.project.code} – ${bill.project.name}` },
      { label: "Client PO", value: `${bill.clientPo.clientPoNumber} (${bill.clientPo.number})` },
      { label: "Period", value: `${formatDate(bill.periodFrom)} → ${formatDate(bill.periodTo)}` },
      ...(bill.clientCertRef ? [{ label: "Client certificate", value: `${bill.clientCertRef} · ${formatDate(bill.clientCertDate)}` }] : []),
    ],
    columns: [
      { key: "item", label: "Contract item", w: "30%" },
      { key: "contract", label: "Contract qty", w: "11%", align: "right" },
      { key: "prev", label: "Previous", w: "10%", align: "right" },
      { key: "claim", label: "This bill", w: "10%", align: "right" },
      { key: "cert", label: "Certified", w: "10%", align: "right" },
      { key: "rate", label: "Rate", w: "11%", align: "right" },
      { key: "amt", label: "Amount", w: "18%", align: "right" },
    ],
    rows: bill.lines.map((l) => ({ item: `${l.clientPoLine.lineNo}. ${l.clientPoLine.description}${l.measurementRef ? `\nMB: ${l.measurementRef}` : ""}`, contract: `${q(l.contractQty)} ${l.clientPoLine.unit}`, prev: q(l.prevCertifiedQty), claim: q(l.claimedQty), cert: l.certifiedQty ?? "—", rate: rs(l.rate).replace("Rs. ", ""), amt: rs(l.certifiedAmount ?? l.claimedAmount) })),
    totals: [
      { label: bill.certified ? "Certified value" : "Claimed value", value: rs(bill.gross) },
      { label: "GST", value: rs(bill.gstAmount) },
      { label: `Less retention (${q(bill.retentionPct)}%)`, value: `-${rs(bill.retentionAmount)}` },
      { label: "Less advance recovery", value: `-${rs(bill.advanceRecovery)}` },
      { label: "Less other deductions", value: `-${rs(bill.otherDeductions)}` },
      { label: "Net payable", value: rs(bill.netPayable), strong: true },
    ],
    amountInWords: amountInWords(bill.netPayable),
    notes: [...(bill.deductionNotes ? [{ label: "Deductions", value: bill.deductionNotes }] : []), ...(bill.remarks ? [{ label: "Remarks", value: bill.remarks }] : [])],
    signatures: ["Prepared by", "Site engineer", "Client certification"],
  };
}

export async function clientInvoicePdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { invoice: inv } = await getClientInvoice(actor, id);
  const intra = inv.taxMode === "INTRA";
  const ded = [inv.retentionAmount, inv.advanceRecovery, inv.otherDeductions].some((v) => v !== "0.00");
  return {
    title: inv.status === "DRAFT" ? "Tax Invoice (DRAFT – not valid)" : "Tax Invoice",
    number: inv.number,
    date: formatDate(inv.invoiceDate),
    status: human(inv.status),
    org: await orgHeader(actor),
    party: partyBlock("Bill to", inv.party),
    meta: [
      { label: "Project / site", value: `${inv.project.code} – ${inv.project.name}` },
      { label: "Place of supply", value: inv.placeOfSupply ? `${inv.placeOfSupply} – ${stateName(inv.placeOfSupply)}` : "—" },
      { label: "Due date", value: formatDate(inv.dueDate) },
      ...(inv.clientPo ? [{ label: "Client PO", value: `${inv.clientPo.clientPoNumber} dt ${formatDate(inv.clientPo.poDate)}` }] : []),
      ...(inv.raBill ? [{ label: "Running bill", value: `RA-${inv.raBill.raNumber} (${formatDate(inv.raBill.periodFrom)} – ${formatDate(inv.raBill.periodTo)})${inv.raBill.clientCertRef ? `, cert ${inv.raBill.clientCertRef}` : ""}` }] : []),
      ...(inv.so ? [{ label: "Sales order", value: inv.so.number }] : []),
    ],
    columns: priced,
    rows: inv.lines.map((l) => ({ n: String(l.lineNo), item: l.description, hsn: l.hsnSac ?? "", qty: `${q(l.quantity)} ${l.unit ?? ""}`, rate: rs(l.rate).replace("Rs. ", ""), gst: q(l.gstRate), amt: rs(l.taxable) })),
    totals: [
      { label: "Taxable value", value: rs(inv.taxable) },
      ...(intra ? [{ label: "CGST", value: rs(inv.cgst) }, { label: "SGST", value: rs(inv.sgst) }] : [{ label: "IGST", value: rs(inv.igst) }]),
      ...(inv.roundOff !== "0.00" ? [{ label: "Round off", value: rs(inv.roundOff) }] : []),
      { label: "Invoice total", value: rs(inv.total), strong: true },
      ...(ded
        ? [
            { label: "Less retention", value: `-${rs(inv.retentionAmount)}` },
            { label: "Less advance recovery", value: `-${rs(inv.advanceRecovery)}` },
            { label: "Less other deductions", value: `-${rs(inv.otherDeductions)}` },
            { label: "Net receivable", value: rs(inv.netReceivable), strong: true },
          ]
        : []),
    ],
    amountInWords: amountInWords(inv.total),
    notes: inv.notes ? [{ label: "Notes", value: inv.notes }] : [],
    signatures: ["For the company – authorised signatory"],
  };
}
