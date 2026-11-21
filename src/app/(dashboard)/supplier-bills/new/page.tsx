import type { Metadata } from "next";
import { BillForm, linesFromPrefill, refsFromPrefill } from "@/components/payables/bill-form";
import { payablesCrumbs } from "@/components/payables/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getCommercialSettings } from "@/modules/commercial/core";
import { partyOptions } from "@/modules/parties/service";
import { billPrefillFromPo, billablePoOptions } from "@/modules/payables/bills";
import { listProjectOptions } from "@/modules/projects/service";
import { startOfToday } from "@/modules/tasks/rules";

export const metadata: Metadata = { title: "Enter supplier bill" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export default async function NewBillPage({ searchParams }: PageProps<"/supplier-bills/new">) {
  const user = await requirePagePermission("bills.manage");
  const sp = await searchParams;
  const poId = str(sp.poId);
  const lockedProjectId = str(sp.projectId);
  const [pos, suppliers, projects, settings, prefill] = await Promise.all([billablePoOptions(user), partyOptions(user, "supplier"), listProjectOptions(user, { forTaskCreation: true }), getCommercialSettings(user.organizationId), poId ? billPrefillFromPo(user, poId).catch(() => null) : null]);
  const project = projects.find((p) => p.id === (prefill?.project?.id ?? lockedProjectId)) ?? null;
  const lines = prefill ? linesFromPrefill(prefill) : [];
  return (
    <>
      <PageHeader
        title="Enter supplier bill"
        description="Pick the purchase order and the lines fill in from what was received at site. Differences from the PO are shown before you save."
        breadcrumbs={project ? payablesCrumbs(project, "supplier-bills", "New bill") : [{ label: "Supplier bills", href: "/supplier-bills" }, { label: "New" }]}
      />
      <BillForm
        pos={pos}
        suppliers={suppliers}
        projects={projects}
        companyStateCode={settings.stateCode}
        lockProject={!!lockedProjectId}
        initialRefs={prefill ? refsFromPrefill(prefill) : null}
        initial={{
          kind: "PO",
          poId: prefill ? prefill.po.id : null,
          projectId: prefill?.project?.id ?? lockedProjectId,
          partyId: prefill?.party.id ?? null,
          supplierInvoiceNo: "",
          invoiceDate: startOfToday().toISOString().slice(0, 10),
          dueDate: "",
          supplierGstin: prefill?.party.gstin ?? "",
          charges: "",
          chargesGstRate: "18",
          roundToRupee: true,
          tdsSection: prefill?.party.tdsSection ?? "",
          tdsRate: prefill?.party.tdsRate ?? "",
          remarks: "",
          lines,
        }}
      />
    </>
  );
}
