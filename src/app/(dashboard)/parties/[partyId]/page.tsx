import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DetailGrid, DocStatusBadge, Money, Section, ToneBadge } from "@/components/commercial/ui";
import { ActivityTimeline } from "@/components/documents/activity-timeline";
import { AttachmentsPanel } from "@/components/documents/attachments-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { stateName } from "@/lib/gst";
import { orNotFound } from "@/lib/pages";
import { entityActivity } from "@/modules/documents/activity";
import { listAttachments } from "@/modules/documents/attachments";
import { getParty } from "@/modules/parties/service";

export const metadata: Metadata = { title: "Party" };

export default async function PartyPage({ params }: PageProps<"/parties/[partyId]">) {
  const user = await requirePagePermission("parties.view");
  const { partyId } = await params;
  const p = await orNotFound(getParty(user, partyId));
  const [files, activity] = await Promise.all([listAttachments(user, "party", p.id), entityActivity(user, "party", p.id)]);
  return (
    <>
      <PageHeader
        title={p.name}
        breadcrumbs={[{ label: "Clients & suppliers", href: "/parties" }, { label: p.code }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
            {p.isClient && <ToneBadge tone="info">Client</ToneBadge>}
            {p.isSupplier && <ToneBadge tone="violet">Supplier</ToneBadge>}
            <DocStatusBadge status={p.status} />
          </>
        }
        actions={
          p.capabilities.canManage && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/parties/${p.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Registration & tax">
            <DetailGrid
              items={[
                { label: "Legal name", value: p.legalName },
                { label: "GSTIN", value: p.gstin ? <span className="font-mono">{p.gstin}</span> : "Unregistered" },
                { label: "PAN", value: p.pan ? <span className="font-mono">{p.pan}</span> : null },
                { label: "State (place of supply)", value: p.stateCode ? `${p.stateCode} – ${stateName(p.stateCode)}` : null },
                { label: "Default TDS", value: p.tdsSection ? `${p.tdsSection} @ ${p.tdsRate}%` : null },
                { label: "Payment terms", value: p.paymentTermsDays !== null ? `${p.paymentTermsDays} days` : null },
                { label: "Credit limit", value: p.creditLimit ? <Money value={p.creditLimit} /> : null },
              ]}
            />
          </Section>
          <Section title="Contact & bank">
            <DetailGrid
              items={[
                { label: "Contact person", value: p.contactPerson },
                { label: "Phone", value: p.phone },
                { label: "Email", value: p.email },
                { label: "WhatsApp", value: p.whatsappNumber },
                { label: "Address", value: [p.address, p.city, p.pincode].filter(Boolean).join(", ") || null, wide: true },
                { label: "Bank", value: p.bankName },
                { label: "Account", value: p.bankAccount ? <span className="font-mono">{p.bankAccount}</span> : null },
                { label: "IFSC", value: p.ifsc ? <span className="font-mono">{p.ifsc}</span> : null },
                { label: "Notes", value: p.notes, wide: true },
              ]}
            />
          </Section>
          <ActivityTimeline items={activity} />
        </div>
        <div className="space-y-4">
          <AttachmentsPanel entityType="party" entityId={p.id} data={files} currentUserId={user.id} title="Documents" defaultCategory="CORRESPONDENCE" />
          <p className="px-1 text-xs text-muted-foreground">
            Created {formatDateTime(p.createdAt)}
            {p.createdBy ? ` by ${p.createdBy.fullName}` : ""} · updated {formatDateTime(p.updatedAt)}
          </p>
        </div>
      </div>
    </>
  );
}
