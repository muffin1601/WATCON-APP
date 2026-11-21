import type { Metadata } from "next";
import Link from "next/link";
import { RelatedDocs } from "@/components/commercial/related-docs";
import { DetailGrid, DocStatusBadge, Money, ProgressSegments, Section } from "@/components/commercial/ui";
import { ActivityTimeline } from "@/components/documents/activity-timeline";
import { AttachmentsPanel } from "@/components/documents/attachments-panel";
import { DocShare } from "@/components/documents/doc-share";
import { NextStep, ProjectTrace } from "@/components/procurement/next-step";
import { PoActions } from "@/components/procurement/po-actions";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatQty } from "@/lib/format";
import { stateName } from "@/lib/gst";
import { formatINR } from "@/lib/money";
import { orNotFound } from "@/lib/pages";
import { entityActivity } from "@/modules/documents/activity";
import { listAttachments } from "@/modules/documents/attachments";
import { getPo } from "@/modules/procurement/po";
import { traceSalesOrders } from "@/modules/procurement/trace";

export const metadata: Metadata = { title: "Purchase order" };

export default async function PoPage({ params }: PageProps<"/purchase-orders/[poId]">) {
  const user = await requirePagePermission("po.view");
  const { poId } = await params;
  const { po, can, paidToDate } = await orNotFound(getPo(user, poId));
  const [files, activity, salesOrders] = await Promise.all([listAttachments(user, "purchase_order", po.id), entityActivity(user, "purchase_order", po.id), traceSalesOrders(user, { prIds: [po.prId], prLineIds: po.lines.map((l) => l.prLineId) })]);
  const ordered = po.lines.reduce((a, l) => a + Number(l.quantity), 0);
  const accepted = po.lines.reduce((a, l) => a + Number(l.acceptedQty), 0);
  const rejected = po.lines.reduce((a, l) => a + Number(l.rejectedQty), 0);
  const billed = po.lines.reduce((a, l) => a + Number(l.billedQty), 0);
  const intra = po.taxMode === "INTRA";
  const summary = `Purchase Order ${po.number}${po.revision ? ` (Rev ${po.revision})` : ""}\nSupplier: ${po.party.name}\nDate: ${formatDate(po.orderDate)}\nDeliver to: ${po.deliveryLocation.name}\nExpected: ${formatDate(po.expectedDate)}\nValue: ${formatINR(po.total)}\n\nItems:\n${po.lines.map((l) => `• ${l.itemBrand.item.name} (${l.itemBrand.brand.name}) – ${formatQty(l.quantity)} ${l.unit} @ ₹${l.rate}`).join("\n")}\n\nPlease confirm acceptance. The PDF is attached.`;

  return (
    <>
      <PageHeader
        title={`${po.number}${po.revision ? ` · Rev ${po.revision}` : ""}`}
        breadcrumbs={docCrumbs(po.project, "purchase-orders", { label: po.number })}
        meta={
          <>
            <DocStatusBadge status={po.status} />
            <span className="text-sm text-muted-foreground">
              {po.party.name} · <Money value={po.total} />
            </span>
            <ProjectTrace project={po.project} salesOrders={salesOrders} tab="purchase-orders" />
          </>
        }
        actions={
          <>
            <PoActions id={po.id} version={po.version} can={can} />
            <DocShare type="purchase_order" id={po.id} summary={summary} phone={po.party.whatsappNumber ?? po.party.phone} email={po.party.email} subject={`Purchase Order ${po.number}`} />
          </>
        }
      />
      {(po.status === "DRAFT" || po.status === "REJECTED") && <NextStep tone={po.status === "REJECTED" ? "warn" : "action"} title={po.status === "REJECTED" ? "Rejected — make the changes and resubmit" : "Draft — submit for approval"}>{po.status === "REJECTED" ? (po.statusNote ?? "Edit the order and submit it again.") : "Check supplier, rates and quantities, then submit. The supplier should only receive the PO after approval."}</NextStep>}
      {po.status === "PENDING_APPROVAL" && (can.approve ? <NextStep title="Waiting for your approval">Approve to let purchasing send it to the supplier, or reject it with a reason.</NextStep> : <NextStep tone="info" title="Waiting for approval">{can.approveBlockedReason ?? "An approver will review this order."}</NextStep>)}
      {po.status === "APPROVED" && <NextStep title="Approved — next: send it to the supplier">Use PDF / WhatsApp / email to share it, then press “Mark sent”. Site can already receive material against it.</NextStep>}
      {["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(po.status) && <NextStep tone="info" title={po.status === "PARTIALLY_RECEIVED" ? "Partly delivered — waiting for the rest" : "Waiting for delivery at site"} links={can.receive ? [{ href: `/site-receipts/new?poId=${po.id}`, label: "Receive material" }] : []}>When material arrives, the site records a receipt; accepted quantity updates this order and site stock.</NextStep>}
      {po.status === "FULLY_RECEIVED" && <NextStep tone="done" title="Fully received" links={can.bill ? [{ href: `/supplier-bills/new?poId=${po.id}`, label: "Record supplier bill" }] : []}>All ordered material has been accepted at site. Record the supplier’s bill to match it against these receipts.</NextStep>}
      {po.statusNote && !["REJECTED"].includes(po.status) && <p className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm">{po.statusNote}</p>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Section title="Order">
            <DetailGrid
              items={[
                { label: "Supplier", value: <Link className="hover:underline" href={`/parties/${po.party.id}`}>{po.party.name}</Link> },
                { label: "GSTIN / state", value: `${po.party.gstin ?? "Unregistered"} · ${stateName(po.party.stateCode)}` },
                { label: "Tax", value: intra ? "CGST + SGST" : "IGST (inter-state)" },
                { label: "Project", value: po.project ? `${po.project.code} – ${po.project.name}` : "—" },
                { label: "Deliver to", value: `${po.deliveryLocation.name}${po.deliveryAddress ? ` — ${po.deliveryAddress}` : ""}` },
                { label: "Order date / expected", value: `${formatDate(po.orderDate)} → ${formatDate(po.expectedDate)}` },
                { label: "Payment terms", value: po.paymentTerms },
                { label: "Advance", value: po.advanceAmount !== "0.00" ? <Money value={po.advanceAmount} /> : "None" },
                { label: "Created", value: `${po.createdBy.fullName} · ${formatDateTime(po.createdAt)}` },
                { label: "Approved", value: po.approvedBy ? `${po.approvedBy.fullName} · ${formatDateTime(po.approvedAt)}` : "—" },
                { label: "Sent / acknowledged", value: `${po.sentAt ? formatDateTime(po.sentAt) : "—"} / ${po.acknowledgedAt ? `${formatDateTime(po.acknowledgedAt)}${po.acknowledgementRef ? ` (${po.acknowledgementRef})` : ""}` : "—"}` },
                { label: "Internal remarks", value: po.internalRemarks },
              ]}
            />
          </Section>

          <Section title="Lines & delivery progress" bodyClassName="p-0">
            <div className="border-b px-4 py-3">
              <ProgressSegments
                total={ordered}
                segments={[
                  { label: `Accepted ${formatQty(String(accepted))}`, value: accepted, className: "bg-emerald-500" },
                  { label: `Rejected/damaged ${formatQty(String(rejected))}`, value: rejected, className: "bg-rose-400" },
                  { label: `Pending ${formatQty(String(Math.max(0, ordered - accepted)))}`, value: 0, className: "bg-muted" },
                ]}
              />
              <p className="mt-1 text-xs text-muted-foreground">Billed quantity: {formatQty(String(billed))} of {formatQty(String(ordered))}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Item – brand</th>
                    <th className="px-3 py-2 text-right font-medium">Ordered</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">GST</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Accepted</th>
                    <th className="px-3 py-2 text-right font-medium">Rejected</th>
                    <th className="px-3 py-2 text-right font-medium">Returned</th>
                    <th className="px-3 py-2 text-right font-medium">Pending</th>
                    <th className="px-3 py-2 text-right font-medium">Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{l.lineNo}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.itemBrand.item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.itemBrand.brand.name}
                          {l.hsnCode ? ` · HSN ${l.hsnCode}` : ""}
                          {l.description ? ` · ${l.description}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.quantity)} {l.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINR(l.rate)}{l.discountPct !== "0.00" && <div className="text-xs text-muted-foreground">−{Number(l.discountPct)}%</div>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(l.gstRate)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums"><Money value={l.total} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.receivedQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatQty(l.acceptedQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-700">{l.rejectedQty !== "0" ? formatQty(l.rejectedQty) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.returnedQty !== "0" ? formatQty(l.returnedQty) : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{l.pendingQty !== "0" ? formatQty(l.pendingQty) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.billedQty !== "0" ? formatQty(l.billedQty) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t px-4 py-3">
              <dl className="w-72 space-y-1 text-sm">
                {[["Taxable value", po.taxable], ...(po.charges !== "0.00" ? [["Freight / charges", po.charges]] : []), ...(intra ? [["CGST", po.cgst], ["SGST", po.sgst]] : [["IGST", po.igst]]), ...(po.roundOff !== "0.00" ? [["Round off", po.roundOff]] : [])].map(([l, v]) => (
                  <div key={l} className="flex justify-between">
                    <dt className="text-muted-foreground">{l}</dt>
                    <dd className="tabular-nums">{formatINR(v)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatINR(po.total)}</dd>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <dt>Paid against bills</dt>
                  <dd className="tabular-nums">{formatINR(paidToDate)}</dd>
                </div>
              </dl>
            </div>
          </Section>

          {po.terms && (
            <Section title="Terms & conditions">
              <p className="text-sm whitespace-pre-line">{po.terms}</p>
            </Section>
          )}

          {po.revisions.length > 0 && (
            <Section title="Revision history" bodyClassName="p-0">
              <ul className="divide-y text-sm">
                {po.revisions.map((r) => {
                  const snap = r.snapshot as { total?: string; lines?: unknown[] };
                  return (
                    <li key={r.id} className="flex flex-wrap gap-x-3 px-4 py-2">
                      <span className="font-medium">Rev {r.revision}</span>
                      <span className="text-muted-foreground">{formatDateTime(r.createdAt)} · {r.createdBy.fullName}</span>
                      <span>Value then: {formatINR(String(snap.total ?? "0"))} ({snap.lines?.length ?? 0} lines)</span>
                      <span className="text-muted-foreground">— {r.reason}</span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
          <ActivityTimeline items={activity} />
        </div>
        <div className="space-y-4">
          <RelatedDocs
            docs={[
              ...(po.pr ? [{ type: "Requisition", id: po.pr.id, number: po.pr.number, href: `/purchase-requisitions/${po.pr.id}` }] : []),
              ...(po.rfq ? [{ type: "Rate enquiry", id: po.rfq.id, number: po.rfq.number, href: `/rate-enquiries/${po.rfq.id}` }] : []),
              ...po.grns.map((g) => ({ type: "Site receipt", id: g.id, number: g.number, status: g.status, href: `/site-receipts/${g.id}`, meta: formatDate(g.receiptDate) })),
              ...po.bills.map((b) => ({ type: "Supplier bill", id: b.id, number: b.number, status: b.status, href: `/supplier-bills/${b.id}`, meta: `${b.supplierInvoiceNo} · ${formatINR(b.total)}` })),
            ]}
          />
          <AttachmentsPanel entityType="purchase_order" entityId={po.id} data={files} currentUserId={user.id} defaultCategory="PURCHASE_ORDER" />
        </div>
      </div>
    </>
  );
}
