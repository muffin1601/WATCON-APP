import type { Metadata } from "next";
import Link from "next/link";
import { RelatedDocs } from "@/components/commercial/related-docs";
import { DetailGrid, DocStatusBadge, Money, Section } from "@/components/commercial/ui";
import { ActivityTimeline } from "@/components/documents/activity-timeline";
import { AttachmentsPanel } from "@/components/documents/attachments-panel";
import { DocShare } from "@/components/documents/doc-share";
import { NextStep } from "@/components/procurement/next-step";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { RaActions } from "@/components/sales/actions";
import { CertifyForm, RaStepper } from "@/components/sales/ra-ui";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatQty } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { orNotFound } from "@/lib/pages";
import { entityActivity } from "@/modules/documents/activity";
import { listAttachments } from "@/modules/documents/attachments";
import { getRaBill } from "@/modules/sales/ra-bill";

export const metadata: Metadata = { title: "Running bill" };

export default async function RunningBillPage({ params }: PageProps<"/running-bills/[raId]">) {
  const user = await requirePagePermission("rabill.view");
  const { raId } = await params;
  const { bill, can } = await orNotFound(getRaBill(user, raId));
  const [files, activity] = await Promise.all([listAttachments(user, "ra_bill", bill.id), entityActivity(user, "ra_bill", bill.id)]);
  const share = `Running bill ${bill.number} (RA-${bill.raNumber})\nContract: ${bill.clientPo.clientPoNumber}\nPeriod: ${formatDate(bill.periodFrom)} to ${formatDate(bill.periodTo)}\nClaimed: ${formatINR(bill.claimedAmount)}\n\nThe PDF is attached.`;
  return (
    <>
      <PageHeader
        title={`${bill.number} · RA-${bill.raNumber}`}
        breadcrumbs={[...projectCrumbs(bill.project, "running-bills"), { label: bill.number }]}
        meta={
          <>
            <DocStatusBadge status={bill.status} />
            <span className="text-sm text-muted-foreground">
              {bill.party.name} · <Money value={bill.gross} />
            </span>
          </>
        }
        actions={
          <>
            <RaActions id={bill.id} version={bill.version} can={can} />
            {can.certify && <CertifyForm id={bill.id} version={bill.version} lines={bill.lines.map((l) => ({ id: l.id, lineNo: l.clientPoLine.lineNo, description: l.clientPoLine.description, unit: l.clientPoLine.unit, claimedQty: l.claimedQty, rate: l.rate }))} otherDeductions={bill.otherDeductions} deductionNotes={bill.deductionNotes} />}
            <DocShare type="ra_bill" id={bill.id} summary={share} phone={bill.party.whatsappNumber ?? bill.party.phone} email={bill.party.email} subject={`Running bill ${bill.number}`} />
          </>
        }
      />
      <RaStepper status={bill.status} />
      {bill.status === "DRAFT" && <NextStep title="Draft — send for internal review">Check quantities against the measurement sheet, then send for review.</NextStep>}
      {bill.status === "SUBMITTED" && <NextStep tone="info" title="With the client">Share the PDF with the client, then record their certification (or a dispute).</NextStep>}
      {bill.status === "DISPUTED" && <NextStep tone="warn" title="Disputed by the client">{bill.disputeNote ?? "Resolve the objection, then resubmit or record the certification."}</NextStep>}
      {bill.status === "CLIENT_CERTIFIED" && <NextStep title="Certified — raise the invoice" links={can.invoice ? [{ href: `/client-invoices/new?raBillId=${bill.id}`, label: "Create invoice" }] : []}>The tax invoice is raised for the certified quantities.</NextStep>}
      {bill.statusNote && <p className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm">{bill.statusNote}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Section title="Bill">
            <DetailGrid
              items={[
                { label: "Client", value: <Link className="hover:underline" href={`/parties/${bill.party.id}`}>{bill.party.name}</Link> },
                { label: "Client PO", value: <Link className="hover:underline" href={`/client-pos/${bill.clientPo.id}`}>{bill.clientPo.clientPoNumber} ({bill.clientPo.number})</Link> },
                { label: "Project", value: `${bill.project.code} – ${bill.project.name}` },
                { label: "Bill date", value: formatDate(bill.billDate) },
                { label: "Period", value: `${formatDate(bill.periodFrom)} → ${formatDate(bill.periodTo)}` },
                { label: "Prepared by", value: `${bill.createdBy.fullName} · ${formatDateTime(bill.createdAt)}` },
                { label: "Client certificate", value: bill.clientCertRef ? `${bill.clientCertRef} · ${formatDate(bill.clientCertDate)}${bill.certifiedBy ? ` · recorded by ${bill.certifiedBy.fullName}` : ""}` : "—" },
                { label: "Remarks", value: bill.remarks, wide: true },
              ]}
            />
          </Section>
          <Section title="Measurements & amounts" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Contract</th>
                    <th className="px-3 py-2 text-right font-medium">Previous</th>
                    <th className="px-3 py-2 text-right font-medium">This bill</th>
                    <th className="px-3 py-2 text-right font-medium">Cumulative</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">Claimed</th>
                    <th className="px-3 py-2 text-right font-medium">Certified</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bill.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.clientPoLine.lineNo}. {l.clientPoLine.description}</div>
                        <div className="text-xs text-muted-foreground">{[l.clientPoLine.boqRef && `BOQ ${l.clientPoLine.boqRef}`, l.measurementRef && `Measurement ${l.measurementRef}`, l.remarks].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.contractQty)} {l.clientPoLine.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.prevCertifiedQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.certifiedQty ?? l.claimedQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(l.cumulativeQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatINR(l.rate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums"><Money value={l.claimedAmount} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.certifiedAmount ? <Money value={l.certifiedAmount} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t px-4 py-3">
              <dl className="w-80 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">{bill.certified ? "Certified value" : "Claimed value"}</dt><dd className="tabular-nums">{formatINR(bill.gross)}</dd></div>
                {bill.certified && bill.claimedAmount !== bill.certifiedAmount && <div className="flex justify-between text-xs text-muted-foreground"><dt>Originally claimed</dt><dd className="tabular-nums">{formatINR(bill.claimedAmount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">GST</dt><dd className="tabular-nums">{formatINR(bill.gstAmount)}</dd></div>
                {bill.retentionAmount !== "0.00" && <div className="flex justify-between"><dt className="text-muted-foreground">Retention ({Number(bill.retentionPct)}%)</dt><dd className="tabular-nums">− {formatINR(bill.retentionAmount)}</dd></div>}
                {bill.advanceRecovery !== "0.00" && <div className="flex justify-between"><dt className="text-muted-foreground">Advance recovery</dt><dd className="tabular-nums">− {formatINR(bill.advanceRecovery)}</dd></div>}
                {bill.otherDeductions !== "0.00" && <div className="flex justify-between"><dt className="text-muted-foreground">Other deductions</dt><dd className="tabular-nums">− {formatINR(bill.otherDeductions)}</dd></div>}
                <div className="flex justify-between border-t pt-1 text-base font-semibold"><dt>Net payable</dt><dd className="tabular-nums">{formatINR(bill.netPayable)}</dd></div>
              </dl>
            </div>
            {bill.deductionNotes && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Deductions: {bill.deductionNotes}</p>}
          </Section>
          <ActivityTimeline items={activity} />
        </div>
        <div className="space-y-4">
          <RelatedDocs
            docs={[
              { type: "Client PO", id: bill.clientPo.id, number: bill.clientPo.number, href: `/client-pos/${bill.clientPo.id}` },
              ...(bill.invoice ? [{ type: "Invoice", id: bill.invoice.id, number: bill.invoice.number, status: bill.invoice.status, href: `/client-invoices/${bill.invoice.id}`, meta: formatINR(bill.invoice.total) }] : []),
            ]}
          />
          <AttachmentsPanel entityType="ra_bill" entityId={bill.id} data={files} currentUserId={user.id} defaultCategory="MEASUREMENT_SHEET" />
        </div>
      </div>
    </>
  );
}
