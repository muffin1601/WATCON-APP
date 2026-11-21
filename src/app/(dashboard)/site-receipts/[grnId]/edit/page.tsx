import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GrnForm } from "@/components/stores/grn-form";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getGrn, receiptSource } from "@/modules/stores/grn";

export const metadata: Metadata = { title: "Edit site receipt" };

export default async function EditGrnPage({ params }: PageProps<"/site-receipts/[grnId]/edit">) {
  const user = await requirePagePermission("grn.create");
  const { grnId } = await params;
  const { grn, can } = await orNotFound(getGrn(user, grnId));
  if (!can.edit) redirect(`/site-receipts/${grn.id}`);
  const source = await orNotFound(receiptSource(user, grn.poId ? "po" : "challan", (grn.poId ?? grn.challanId)!));
  const byLine = new Map(grn.lines.map((l) => [l.poLineId ?? l.challanLineId, l]));
  const lines = Object.fromEntries(
    source.lines.map((s) => {
      const l = byLine.get(s.sourceLineId);
      return [s.sourceLineId, { received: l?.receivedQty ?? "0", damaged: l?.damagedQty ?? "0", rejected: l?.rejectedQty ?? "0", remarks: l?.remarks ?? "" }];
    }),
  );
  return (
    <>
      <PageHeader title={`Edit ${grn.number}`} breadcrumbs={docCrumbs(grn.project, "site-receipts", { label: grn.number, href: `/site-receipts/${grn.id}` }, { label: "Edit" })} />
      {grn.statusNote && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Sent back: {grn.statusNote}</p>}
      <GrnForm
        grnId={grn.id}
        version={grn.version}
        source={source}
        lines={lines}
        header={{ receiptDate: grn.receiptDate.toISOString().slice(0, 10), supplierChallanNo: grn.supplierChallanNo ?? "", supplierInvoiceNo: grn.supplierInvoiceNo ?? "", vehicleNo: grn.vehicleNo ?? "", receivedByName: grn.receivedByName ?? "", remarks: grn.remarks ?? "", latitude: grn.latitude ?? "", longitude: grn.longitude ?? "" }}
      />
    </>
  );
}
