import "server-only";
import type { PdfDoc } from "@/components/documents/commercial-pdf";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { stateName } from "@/lib/gst";
import { amountInWords, formatINR } from "@/lib/money";
import type { Actor } from "@/lib/permissions/definitions";
import { getCommercialSettings } from "@/modules/commercial/core";
import { getBill } from "./bills";
import { getNote } from "./notes";
import { PAYMENT_MODE_LABELS, getPayment } from "./payments";

const rs = (v: string | null | undefined) => formatINR(v, { symbol: false }).replace(/^-?/, (m) => `${m}Rs. `);
const q = (v: string) => (v.includes(".") ? v.replace(/\.?0+$/, "") : v);
const human = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

async function orgHeader(actor: Actor): Promise<PdfDoc["org"]> {
  const [org, settings] = await Promise.all([db.organization.findUniqueOrThrow({ where: { id: actor.organizationId } }), getCommercialSettings(actor.organizationId)]);
  return { name: org.name, legalName: org.legalName, address: org.address, phone: org.phone, email: org.email, gstin: settings.gstin, logoDataUrl: org.logoDataUrl };
}

type Party = { name: string; address?: string | null; city?: string | null; gstin: string | null; stateCode: string | null; phone: string | null };
const partyBlock = (label: string, p: Party) => ({ label, name: p.name, address: [p.address, p.city].filter(Boolean).join(", ") || null, gstin: p.gstin, state: p.stateCode ? `${p.stateCode} – ${stateName(p.stateCode)}` : null, phone: p.phone });

export async function supplierBillPdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { bill: b, outstanding } = await getBill(actor, id);
  const intra = b.taxMode === "INTRA";
  return {
    title: "Purchase Bill Voucher",
    number: b.number,
    date: formatDate(b.invoiceDate),
    status: human(b.status),
    org: await orgHeader(actor),
    party: partyBlock("Supplier", b.party),
    meta: [
      { label: "Supplier invoice", value: `${b.supplierInvoiceNo} dated ${formatDate(b.invoiceDate)}` },
      { label: "Project", value: b.project ? `${b.project.code} – ${b.project.name}` : "—" },
      { label: "Purchase order", value: b.po?.number ?? "Without PO" },
      { label: "Due date", value: formatDate(b.dueDate) },
      { label: "Match", value: b.matchStatus === "MATCHED" ? "Matched with PO / receipts" : b.matchStatus === "EXCEPTION" ? `Exceptions${b.overrideReason ? ` – overridden: ${b.overrideReason}` : ""}` : "Not matched (no PO)" },
      ...(b.tdsSection ? [{ label: "TDS", value: `${b.tdsSection} @ ${q(b.tdsRate ?? "0")}%` }] : []),
    ],
    columns: [
      { key: "n", label: "#", w: "5%" },
      { key: "item", label: "Description", w: "37%" },
      { key: "hsn", label: "HSN", w: "9%" },
      { key: "qty", label: "Qty", w: "11%", align: "right" },
      { key: "rate", label: "Rate", w: "12%", align: "right" },
      { key: "gst", label: "GST%", w: "8%", align: "right" },
      { key: "amt", label: "Amount", w: "18%", align: "right" },
    ],
    rows: b.lines.map((l) => ({ n: String(l.lineNo), item: `${l.description}${l.grnLine ? `\nReceipt ${l.grnLine.grn.number}` : ""}`, hsn: l.hsnCode ?? "", qty: `${q(l.quantity)} ${l.unit ?? ""}`.trim(), rate: rs(l.rate).replace("Rs. ", ""), gst: q(l.gstRate), amt: rs(l.total) })),
    totals: [
      { label: "Taxable value", value: rs(b.taxable) },
      ...(b.charges !== "0.00" ? [{ label: "Freight / charges", value: rs(b.charges) }] : []),
      ...(intra ? [{ label: "CGST", value: rs(b.cgst) }, { label: "SGST", value: rs(b.sgst) }] : [{ label: "IGST", value: rs(b.igst) }]),
      ...(b.roundOff !== "0.00" ? [{ label: "Round off", value: rs(b.roundOff) }] : []),
      { label: "Invoice total", value: rs(b.total), strong: true },
      ...(b.tdsAmount !== "0.00" ? [{ label: "Less TDS", value: rs(b.tdsAmount) }] : []),
      { label: "Net payable", value: rs(b.netPayable), strong: true },
      { label: "Paid / adjusted", value: rs(String((Number(b.paidAmount) + Number(b.adjustedAmount)).toFixed(2))) },
      { label: "Outstanding", value: rs(outstanding) },
    ],
    amountInWords: amountInWords(b.netPayable),
    notes: b.remarks ? [{ label: "Remarks", value: b.remarks }] : [],
    signatures: ["Entered by", "Checked by", "Approved by"],
  };
}

export async function paymentPdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { payment: p, unallocated } = await getPayment(actor, id);
  const out = p.direction === "OUT";
  const active = p.allocations.filter((a) => !a.reversedAt);
  return {
    title: out ? "Payment Voucher" : "Receipt Voucher",
    number: p.number,
    date: formatDate(p.paymentDate),
    status: human(p.status),
    org: await orgHeader(actor),
    party: partyBlock(out ? "Paid to" : "Received from", p.party),
    meta: [
      { label: "Mode", value: PAYMENT_MODE_LABELS[p.mode] },
      { label: "Reference", value: p.reference ?? "—" },
      ...(p.bankAccount ? [{ label: "Bank account", value: p.bankAccount }] : []),
      { label: "Project", value: p.project ? `${p.project.code} – ${p.project.name}` : "—" },
    ],
    columns: [
      { key: "n", label: "#", w: "6%" },
      { key: "doc", label: out ? "Against bill" : "Against invoice", w: "64%" },
      { key: "amt", label: "Amount", w: "30%", align: "right" },
    ],
    rows: active.map((a, i) => ({ n: String(i + 1), doc: a.supplierBill ? `${a.supplierBill.number} (supplier invoice ${a.supplierBill.supplierInvoiceNo})` : (a.clientInvoice?.number ?? ""), amt: rs(a.amount) })),
    totals: [
      { label: out ? "Amount paid" : "Amount received", value: rs(p.amount) },
      ...(p.tdsAmount !== "0.00" ? [{ label: "TDS deducted by client", value: rs(p.tdsAmount) }] : []),
      { label: "Total settled", value: rs(p.gross), strong: true },
      ...(unallocated !== "0.00" ? [{ label: "Unallocated (advance)", value: rs(unallocated) }] : []),
    ],
    amountInWords: amountInWords(p.amount),
    notes: p.remarks ? [{ label: "Remarks", value: p.remarks }] : [],
    signatures: out ? ["Prepared by", "Authorised by", "Receiver's signature"] : ["Prepared by", "Authorised by"],
  };
}

export async function notePdf(actor: Actor, id: string): Promise<PdfDoc> {
  const { note: n } = await getNote(actor, id);
  const credit = n.noteType === "CREDIT";
  return {
    title: credit ? "Credit Note" : "Debit Note",
    number: n.number,
    date: formatDate(n.noteDate),
    status: human(n.status),
    org: await orgHeader(actor),
    party: partyBlock(n.partyRole === "SUPPLIER" ? "Supplier" : "Client", n.party),
    meta: [
      { label: "Against", value: n.supplierBill ? `Bill ${n.supplierBill.number} (invoice ${n.supplierBill.supplierInvoiceNo})` : n.clientInvoice ? `Invoice ${n.clientInvoice.number}` : "—" },
      { label: "Project", value: n.project ? `${n.project.code} – ${n.project.name}` : "—" },
      ...(n.partyNoteRef ? [{ label: "Party reference", value: n.partyNoteRef }] : []),
    ],
    columns: [
      { key: "d", label: "Reason", w: "60%" },
      { key: "gst", label: "GST%", w: "12%", align: "right" },
      { key: "amt", label: "Taxable", w: "28%", align: "right" },
    ],
    rows: [{ d: n.reason, gst: q(n.gstRate), amt: rs(n.taxable) }],
    totals: [
      { label: "Taxable value", value: rs(n.taxable) },
      { label: n.taxMode === "INTRA" ? "CGST + SGST" : "IGST", value: rs(n.taxAmount) },
      { label: "Total", value: rs(n.total), strong: true },
    ],
    amountInWords: amountInWords(n.total),
    signatures: ["Prepared by", "Approved by"],
  };
}
