import "server-only";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { stateName } from "@/lib/gst";
import { amountInWords, formatINR } from "@/lib/money";
import type { Actor } from "@/lib/permissions/definitions";
import type { PdfDoc } from "@/components/documents/commercial-pdf";
import { getCommercialSettings } from "@/modules/commercial/core";

/** Builds printable models. Every builder loads through the module's scoped getter (same access rules as the page). */

const rs = (v: string | null | undefined) => formatINR(v, { symbol: false }).replace(/^-?/, (m) => `${m}Rs. `);
const q = (v: string) => (v.includes(".") ? v.replace(/\.?0+$/, "") : v);
const human = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

async function orgHeader(actor: Actor): Promise<PdfDoc["org"]> {
  const [org, settings] = await Promise.all([db.organization.findUniqueOrThrow({ where: { id: actor.organizationId } }), getCommercialSettings(actor.organizationId)]);
  return { name: org.name, legalName: org.legalName, address: org.address, phone: org.phone, email: org.email, gstin: settings.gstin, logoDataUrl: org.logoDataUrl };
}

type Builder = (actor: Actor, id: string) => Promise<PdfDoc>;

const BUILDERS: Record<string, () => Promise<Builder>> = {
  client_po: async () => (await import("@/modules/sales/pdf")).clientPoPdf,
  sales_order: async () => (await import("@/modules/sales/pdf")).salesOrderPdf,
  ra_bill: async () => (await import("@/modules/sales/pdf")).raBillPdf,
  client_invoice: async () => (await import("@/modules/sales/pdf")).clientInvoicePdf,
  supplier_bill: async () => (await import("@/modules/payables/pdf")).supplierBillPdf,
  payment: async () => (await import("@/modules/payables/pdf")).paymentPdf,
  adjustment_note: async () => (await import("@/modules/payables/pdf")).notePdf,
  purchase_order: async () => {
    const { getPo } = await import("@/modules/procurement/po");
    return async (actor, id) => {
      const { po } = await getPo(actor, id);
      const intra = po.taxMode === "INTRA";
      return {
        title: "Purchase Order",
        number: `${po.number}${po.revision ? ` (Rev ${po.revision})` : ""}`,
        date: formatDate(po.orderDate),
        status: human(po.status),
        org: await orgHeader(actor),
        party: { label: "Supplier", name: po.party.name, address: [po.party.address, po.party.city].filter(Boolean).join(", ") || null, gstin: po.party.gstin, state: po.party.stateCode ? `${po.party.stateCode} – ${stateName(po.party.stateCode)}` : null, phone: po.party.phone },
        meta: [
          { label: "Project", value: po.project ? `${po.project.code} – ${po.project.name}` : "Central store" },
          { label: "Deliver to", value: `${po.deliveryLocation.name}${po.deliveryLocation.address ? `, ${po.deliveryLocation.address}` : ""}${po.deliveryAddress ? ` (${po.deliveryAddress})` : ""}` },
          { label: "Expected delivery", value: formatDate(po.expectedDate) },
          { label: "Payment terms", value: po.paymentTerms ?? "—" },
          ...(po.advanceAmount !== "0.00" ? [{ label: "Advance", value: rs(po.advanceAmount) }] : []),
          ...(po.pr ? [{ label: "Requisition", value: po.pr.number }] : []),
          ...(po.rfq ? [{ label: "Rate enquiry", value: po.rfq.number }] : []),
        ],
        columns: [
          { key: "n", label: "#", w: "4%" },
          { key: "item", label: "Item / description", w: "34%" },
          { key: "hsn", label: "HSN", w: "9%" },
          { key: "qty", label: "Qty", w: "10%", align: "right" },
          { key: "rate", label: "Rate", w: "11%", align: "right" },
          { key: "disc", label: "Disc%", w: "7%", align: "right" },
          { key: "gst", label: "GST%", w: "7%", align: "right" },
          { key: "amt", label: "Amount", w: "18%", align: "right" },
        ],
        rows: po.lines.map((l) => ({ n: String(l.lineNo), item: `${l.itemBrand.item.name} – ${l.itemBrand.brand.name}${l.description ? `\n${l.description}` : ""}`, hsn: l.hsnCode ?? "", qty: `${q(l.quantity)} ${l.unit}`, rate: rs(l.rate).replace("Rs. ", ""), disc: q(l.discountPct), gst: q(l.gstRate), amt: rs(l.total) })),
        totals: [
          { label: "Taxable value", value: rs(po.taxable) },
          ...(po.charges !== "0.00" ? [{ label: "Freight / charges", value: rs(po.charges) }] : []),
          ...(intra ? [{ label: "CGST", value: rs(po.cgst) }, { label: "SGST", value: rs(po.sgst) }] : [{ label: "IGST", value: rs(po.igst) }]),
          ...(po.roundOff !== "0.00" ? [{ label: "Round off", value: rs(po.roundOff) }] : []),
          { label: "Total", value: rs(po.total), strong: true },
        ],
        amountInWords: amountInWords(po.total),
        notes: po.terms ? [{ label: "Terms & conditions", value: po.terms }] : [],
        signatures: ["Prepared by", "Approved by", "Supplier acceptance"],
      };
    };
  },
  purchase_requisition: async () => {
    const { getPr } = await import("@/modules/procurement/pr");
    return async (actor, id) => {
      const { pr } = await getPr(actor, id);
      return {
        title: "Purchase Requisition",
        number: pr.number,
        date: formatDate(pr.createdAt),
        status: human(pr.status),
        org: await orgHeader(actor),
        meta: [
          { label: "Project", value: pr.project ? `${pr.project.code} – ${pr.project.name}` : "Central store" },
          { label: "Deliver to", value: pr.deliveryLocation?.name ?? "—" },
          { label: "Required by", value: formatDate(pr.requiredBy) },
          { label: "Raised by", value: pr.createdBy.fullName },
          ...(pr.approvedBy ? [{ label: "Approved by", value: pr.approvedBy.fullName }] : []),
        ],
        columns: [
          { key: "n", label: "#", w: "5%" },
          { key: "item", label: "Item – brand", w: "45%" },
          { key: "qty", label: "Quantity", w: "15%", align: "right" },
          { key: "ordered", label: "Ordered", w: "15%", align: "right" },
          { key: "by", label: "Required by", w: "20%" },
        ],
        rows: pr.lines.map((l) => ({ n: String(l.lineNo), item: `${l.itemBrand.item.name} – ${l.itemBrand.brand.name}${l.notes ? `\n${l.notes}` : ""}`, qty: `${q(l.quantity)} ${l.itemBrand.item.unit}`, ordered: q(l.orderedQty), by: formatDate(l.requiredBy) })),
        notes: pr.purpose ? [{ label: "Purpose", value: pr.purpose }] : [],
        signatures: ["Requested by", "Approved by"],
      };
    };
  },
  rfq: async () => {
    const { getRfq } = await import("@/modules/procurement/rfq");
    return async (actor, id) => {
      const { rfq } = await getRfq(actor, id);
      return {
        title: "Request for Quotation",
        number: rfq.number,
        date: formatDate(rfq.createdAt),
        org: await orgHeader(actor),
        meta: [
          { label: "Subject", value: rfq.title },
          { label: "Delivery", value: [rfq.deliveryLocation?.name, rfq.deliveryAddress].filter(Boolean).join(", ") || "—" },
          { label: "Required by", value: formatDate(rfq.requiredBy) },
          { label: "Quote by", value: formatDate(rfq.responseDue) },
          { label: "Payment terms", value: rfq.paymentTerms ?? "—" },
          { label: "Freight", value: rfq.freightTerms ?? "—" },
          { label: "Taxes", value: rfq.taxTerms ?? "—" },
          { label: "Quote validity", value: rfq.validityDays ? `${rfq.validityDays} days` : "—" },
        ],
        columns: [
          { key: "n", label: "#", w: "5%" },
          { key: "item", label: "Material & specification", w: "45%" },
          { key: "brand", label: "Brand (acceptable alternatives)", w: "30%" },
          { key: "qty", label: "Quantity", w: "20%", align: "right" },
        ],
        rows: rfq.lines.map((l) => ({ n: String(l.lineNo), item: `${l.item.name}${l.specifications ? `\n${l.specifications}` : ""}`, brand: [l.itemBrand?.brand.name, l.acceptableBrands].filter(Boolean).join(" / ") || "Any", qty: `${q(l.quantity)} ${l.unit}` })),
        notes: [...(rfq.specifications ? [{ label: "Specifications", value: rfq.specifications }] : []), { label: "Please quote", value: "Rate per unit before tax, discount, GST %, freight, delivery lead time and validity." }],
      };
    };
  },
  grn: async () => {
    const { getGrn } = await import("@/modules/stores/grn");
    return async (actor, id) => {
      const { grn } = await getGrn(actor, id);
      return {
        title: "Goods Receipt Note",
        number: grn.number,
        date: formatDate(grn.receiptDate),
        status: human(grn.status),
        org: await orgHeader(actor),
        party: grn.party ? { label: "Supplier", name: grn.party.name } : null,
        meta: [
          { label: "Project", value: grn.project ? `${grn.project.code} – ${grn.project.name}` : "—" },
          { label: "Received at", value: grn.location.name },
          { label: "Against", value: grn.po?.number ?? grn.challan?.number ?? "—" },
          { label: "Supplier challan / invoice", value: [grn.supplierChallanNo, grn.supplierInvoiceNo].filter(Boolean).join(" / ") || "—" },
          { label: "Vehicle", value: grn.vehicleNo ?? "—" },
          { label: "Received by", value: grn.receivedByName ?? grn.createdBy.fullName },
          ...(grn.postedBy ? [{ label: "Verified & posted by", value: grn.postedBy.fullName }] : []),
        ],
        columns: [
          { key: "n", label: "#", w: "4%" },
          { key: "item", label: "Item – brand", w: "36%" },
          { key: "exp", label: "Expected", w: "12%", align: "right" },
          { key: "rec", label: "Received", w: "12%", align: "right" },
          { key: "acc", label: "Accepted", w: "12%", align: "right" },
          { key: "dmg", label: "Damaged", w: "12%", align: "right" },
          { key: "rej", label: "Rejected", w: "12%", align: "right" },
        ],
        rows: grn.lines.map((l) => ({ n: String(l.lineNo), item: `${l.itemBrand.item.name} – ${l.itemBrand.brand.name}${l.remarks ? `\n${l.remarks}` : ""}`, exp: q(l.expectedQty), rec: `${q(l.receivedQty)} ${l.itemBrand.item.unit}`, acc: q(l.acceptedQty), dmg: q(l.damagedQty), rej: q(l.rejectedQty) })),
        notes: grn.remarks ? [{ label: "Remarks", value: grn.remarks }] : [],
        signatures: ["Received by (site)", "Verified by", "Storekeeper"],
      };
    };
  },
  challan: async () => {
    const { getChallan, CHALLAN_TYPE_LABELS } = await import("@/modules/stores/challan");
    return async (actor, id) => {
      const { challan: c } = await getChallan(actor, id);
      return {
        title: "Delivery Challan",
        number: c.number,
        date: formatDate(c.dispatchDate ?? c.createdAt),
        status: human(c.status),
        org: await orgHeader(actor),
        party: c.party ? { label: c.type === "CLIENT_DELIVERY" ? "Consignee" : "Supplier", name: c.party.name, address: c.party.address, gstin: c.party.gstin } : c.toLocation ? { label: "Deliver to", name: c.toLocation.name, address: c.toLocation.address } : null,
        meta: [
          { label: "Type", value: CHALLAN_TYPE_LABELS[c.type] },
          { label: "From", value: c.fromLocation?.name ?? "—" },
          ...(c.project ? [{ label: "Project", value: `${c.project.code} – ${c.project.name}` }] : []),
          { label: "Vehicle", value: c.vehicleNo ?? "—" },
          { label: "Transporter / LR", value: [c.transporter, c.lrNumber].filter(Boolean).join(" / ") || "—" },
          { label: "Driver", value: [c.driverName, c.driverPhone].filter(Boolean).join(" · ") || "—" },
          ...(c.po ? [{ label: "Reference PO", value: c.po.number }] : []),
          ...(c.so ? [{ label: "Reference SO", value: c.so.number }] : []),
        ],
        columns: [
          { key: "n", label: "#", w: "6%" },
          { key: "item", label: "Item – brand", w: "50%" },
          { key: "hsn", label: "HSN", w: "14%" },
          { key: "qty", label: "Quantity", w: "30%", align: "right" },
        ],
        rows: c.lines.map((l) => ({ n: String(l.lineNo), item: `${l.itemBrand.item.name} – ${l.itemBrand.brand.name}${l.remarks ? `\n${l.remarks}` : ""}`, hsn: l.itemBrand.item.hsnCode ?? "", qty: `${q(l.quantity)} ${l.itemBrand.item.unit}` })),
        notes: [{ label: "Note", value: "Goods sent for the purpose stated above. Not for sale unless accompanied by a tax invoice." }, ...(c.remarks ? [{ label: "Remarks", value: c.remarks }] : [])],
        signatures: ["Dispatched by", "Driver", "Received by (name, sign, date)"],
      };
    };
  },
};

export function registerPdfBuilder(type: string, loader: () => Promise<Builder>) {
  BUILDERS[type] = loader;
}

export async function buildPdfModel(actor: Actor, type: string, id: string): Promise<PdfDoc> {
  const loader = BUILDERS[type];
  if (!loader || !/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundError("Document");
  return (await loader())(actor, id);
}
