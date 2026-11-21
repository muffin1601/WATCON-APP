import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid, DocStatusBadge, Money, Section } from "@/components/commercial/ui";
import { ActivityTimeline } from "@/components/documents/activity-timeline";
import { AttachmentsPanel } from "@/components/documents/attachments-panel";
import { DocShare } from "@/components/documents/doc-share";
import { payablesCrumbs } from "@/components/payables/crumbs";
import { NoteActions } from "@/components/payables/note-ui";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { orNotFound } from "@/lib/pages";
import { can as canDo } from "@/lib/permissions/definitions";
import { entityActivity } from "@/modules/documents/activity";
import { listAttachments } from "@/modules/documents/attachments";
import { getNote } from "@/modules/payables/notes";

export const metadata: Metadata = { title: "Credit / debit note" };

export default async function NotePage({ params }: PageProps<"/notes/[noteId]">) {
  const user = await requireUser();
  if (!canDo(user, "bills.view") && !canDo(user, "invoice.view")) notFound();
  const { noteId } = await params;
  const { note: n, can } = await orNotFound(getNote(user, noteId));
  const [files, activity] = await Promise.all([listAttachments(user, "adjustment_note", n.id), entityActivity(user, "adjustment_note", n.id)]);
  const kind = `${n.noteType === "CREDIT" ? "Credit" : "Debit"} note`;
  return (
    <>
      <PageHeader
        title={`${kind} ${n.number}`}
        breadcrumbs={payablesCrumbs(n.project, "notes", n.number)}
        meta={
          <>
            <DocStatusBadge status={n.status} />
            <span className="text-sm text-muted-foreground">
              {n.party.name} · <Money value={n.total} />
            </span>
          </>
        }
        actions={
          <>
            <NoteActions id={n.id} version={n.version} can={can} />
            <DocShare type="adjustment_note" id={n.id} summary={`${kind} ${n.number}\n${n.party.name}\nAmount: ${formatINR(n.total)}\nReason: ${n.reason}`} phone={n.party.phone} subject={`${kind} ${n.number}`} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <Section title="Note">
            <DetailGrid
              items={[
                { label: n.partyRole === "SUPPLIER" ? "Supplier" : "Client", value: <Link className="hover:underline" href={`/parties/${n.party.id}`}>{n.party.name}</Link> },
                { label: "Against", value: n.supplierBill ? <Link className="hover:underline" href={`/supplier-bills/${n.supplierBill.id}`}>{n.supplierBill.number} (invoice {n.supplierBill.supplierInvoiceNo})</Link> : n.clientInvoice ? <Link className="hover:underline" href={`/client-invoices/${n.clientInvoice.id}`}>{n.clientInvoice.number}</Link> : "—" },
                { label: "Project", value: n.project ? <Link className="hover:underline" href={`/projects/${n.project.id}?tab=notes`}>{n.project.code} – {n.project.name}</Link> : "—" },
                { label: "Date", value: formatDate(n.noteDate) },
                { label: "Party reference", value: n.partyNoteRef },
                { label: "Taxable", value: <Money value={n.taxable} /> },
                { label: `GST ${Number(n.gstRate)}% (${n.taxMode === "INTRA" ? "CGST + SGST" : "IGST"})`, value: <Money value={n.taxAmount} /> },
                { label: "Total", value: <Money value={n.total} /> },
                { label: "Created", value: `${n.createdBy.fullName} · ${formatDateTime(n.createdAt)}` },
                { label: "Approved", value: n.approvedBy ? `${n.approvedBy.fullName} · ${formatDateTime(n.approvedAt)}` : "Not yet — it does not affect the balance until approved" },
                { label: "Reason", value: n.reason, wide: true },
              ]}
            />
          </Section>
          <ActivityTimeline items={activity} />
        </div>
        <AttachmentsPanel entityType="adjustment_note" entityId={n.id} data={files} currentUserId={user.id} defaultCategory="CORRESPONDENCE" />
      </div>
    </>
  );
}
