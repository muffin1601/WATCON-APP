import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PoForm } from "@/components/procurement/po-form";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getCommercialSettings } from "@/modules/commercial/core";
import { itemBrandOptions, listLocationOptions } from "@/modules/inventory/locations";
import { partyOptions } from "@/modules/parties/service";
import { getPo } from "@/modules/procurement/po";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Edit purchase order" };

export default async function EditPoPage({ params }: PageProps<"/purchase-orders/[poId]/edit">) {
  const user = await requirePagePermission("po.create");
  const { poId } = await params;
  const { po, can } = await orNotFound(getPo(user, poId));
  if (!can.edit) redirect(`/purchase-orders/${po.id}`);
  const [suppliers, projects, locations, options, settings] = await Promise.all([partyOptions(user, "supplier"), listProjectOptions(user, { forTaskCreation: true }), listLocationOptions(user), itemBrandOptions(user), getCommercialSettings(user.organizationId)]);
  return (
    <>
      <PageHeader title={`Edit ${po.number}${po.revision ? ` (amendment ${po.revision})` : ""}`} breadcrumbs={docCrumbs(po.project, "purchase-orders", { label: po.number, href: `/purchase-orders/${po.id}` }, { label: "Edit" })} />
      <PoForm
        poId={po.id}
        version={po.version}
        amendment={po.revision || undefined}
        suppliers={suppliers}
        projects={projects}
        locations={locations}
        options={options}
        companyStateCode={settings.stateCode}
        defaultTerms={settings.poTerms}
        initial={{
          projectId: po.projectId,
          partyId: po.partyId,
          deliveryLocationId: po.deliveryLocationId,
          deliveryAddress: po.deliveryAddress ?? "",
          orderDate: po.orderDate.toISOString().slice(0, 10),
          expectedDate: po.expectedDate?.toISOString().slice(0, 10) ?? "",
          paymentTerms: po.paymentTerms ?? "",
          advanceAmount: po.advanceAmount === "0.00" ? "" : po.advanceAmount,
          terms: po.terms ?? "",
          internalRemarks: po.internalRemarks ?? "",
          charges: po.charges === "0.00" ? "" : po.charges,
          chargesGstRate: String(Number(po.chargesGstRate)),
          roundToRupee: po.roundOff !== "0.00" || true,
          rfqId: po.rfqId,
          prId: po.prId,
          lines: po.lines.map((l) => ({ key: l.id, id: l.id, itemBrandId: l.itemBrandId, description: l.description ?? "", quantity: l.quantity, rate: l.rate, discountPct: l.discountPct, gstRate: String(Number(l.gstRate)), note: l.receivedQty !== "0" || l.billedQty !== "0" ? `Received ${l.receivedQty} · accepted ${l.acceptedQty} · billed ${l.billedQty}` : undefined, links: { prLineId: l.prLineId, quotationLineId: l.quotationLineId } })),
        }}
      />
    </>
  );
}
