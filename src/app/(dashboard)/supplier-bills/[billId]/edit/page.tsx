import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BillForm, refsFromPrefill } from "@/components/payables/bill-form";
import { payablesCrumbs } from "@/components/payables/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getCommercialSettings } from "@/modules/commercial/core";
import { partyOptions } from "@/modules/parties/service";
import { billPrefillFromPo, billablePoOptions, getBill } from "@/modules/payables/bills";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Edit supplier bill" };

export default async function EditBillPage({ params }: PageProps<"/supplier-bills/[billId]/edit">) {
  const user = await requirePagePermission("bills.manage");
  const { billId } = await params;
  const { bill: b, can } = await orNotFound(getBill(user, billId));
  if (!can.edit) redirect(`/supplier-bills/${b.id}`);
  const [pos, suppliers, projects, settings, prefill] = await Promise.all([billablePoOptions(user), partyOptions(user, "supplier"), listProjectOptions(user, { forTaskCreation: true }), getCommercialSettings(user.organizationId), b.poId ? billPrefillFromPo(user, b.poId).catch(() => null) : null]);
  const poOptions = b.po && !pos.some((p) => p.id === b.po!.id) ? [...pos, { id: b.po.id, number: b.po.number, supplier: b.party.name, projectId: b.projectId, project: b.project?.code ?? null, total: b.po.total, orderDate: b.createdAt.toISOString() }] : pos;
  return (
    <>
      <PageHeader title={`Edit ${b.number}`} breadcrumbs={payablesCrumbs(b.project, "supplier-bills", `Edit ${b.number}`)} />
      <BillForm
        billId={b.id}
        version={b.version}
        pos={poOptions}
        suppliers={suppliers}
        projects={projects}
        companyStateCode={settings.stateCode}
        initialRefs={prefill ? refsFromPrefill(prefill) : null}
        initial={{
          kind: b.poId ? "PO" : "DIRECT",
          poId: b.poId,
          projectId: b.projectId,
          partyId: b.partyId,
          supplierInvoiceNo: b.supplierInvoiceNo,
          invoiceDate: b.invoiceDate.toISOString().slice(0, 10),
          dueDate: b.dueDate?.toISOString().slice(0, 10) ?? "",
          supplierGstin: b.supplierGstin ?? "",
          charges: b.charges === "0.00" ? "" : b.charges,
          chargesGstRate: b.chargesGstRate,
          roundToRupee: b.roundOff !== "0.00",
          tdsSection: b.tdsSection ?? "",
          tdsRate: b.tdsRate ?? "",
          remarks: b.remarks ?? "",
          lines: b.lines.map((l) => ({ key: l.id, description: l.description, hsnSac: l.hsnCode ?? "", unit: l.unit ?? "", quantity: l.quantity, rate: l.rate, discountPct: l.discountPct, gstRate: String(Number(l.gstRate)), links: { poLineId: l.poLineId, grnLineId: l.grnLineId, itemBrandId: l.itemBrandId } })),
        }}
      />
    </>
  );
}
