import type { Metadata } from "next";
import { PartyForm } from "@/components/parties/party-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getParty } from "@/modules/parties/service";

export const metadata: Metadata = { title: "Edit party" };

export default async function EditPartyPage({ params }: PageProps<"/parties/[partyId]/edit">) {
  const user = await requirePagePermission("parties.manage");
  const { partyId } = await params;
  const p = await orNotFound(getParty(user, partyId));
  return (
    <>
      <PageHeader title={`Edit ${p.name}`} breadcrumbs={[{ label: "Clients & suppliers", href: "/parties" }, { label: p.code, href: `/parties/${p.id}` }, { label: "Edit" }]} />
      <PartyForm
        partyId={p.id}
        code={p.code}
        defaults={{
          name: p.name,
          legalName: p.legalName ?? "",
          isClient: p.isClient,
          isSupplier: p.isSupplier,
          gstin: p.gstin ?? "",
          pan: p.pan ?? "",
          stateCode: p.stateCode,
          address: p.address ?? "",
          city: p.city ?? "",
          pincode: p.pincode ?? "",
          contactPerson: p.contactPerson ?? "",
          phone: p.phone ?? "",
          email: p.email ?? "",
          whatsappNumber: p.whatsappNumber ?? "",
          paymentTermsDays: p.paymentTermsDays ?? "",
          creditLimit: p.creditLimit ?? "",
          tdsSection: p.tdsSection ?? "",
          tdsRate: p.tdsRate ?? "",
          bankName: p.bankName ?? "",
          bankAccount: p.bankAccount ?? "",
          ifsc: p.ifsc ?? "",
          notes: p.notes ?? "",
          status: p.status,
        }}
      />
    </>
  );
}
