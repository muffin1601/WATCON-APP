import type { Metadata } from "next";
import { RfqForm } from "@/components/procurement/rfq-form";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { newId } from "@/lib/utils";
import { itemBrandOptions, listLocationOptions } from "@/modules/inventory/locations";
import { todayString } from "@/modules/inventory/serialize";
import { partyOptions } from "@/modules/parties/service";
import { prefillRfqFromPr } from "@/modules/procurement/rfq";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "New rate enquiry" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function NewRfqPage({ searchParams }: PageProps<"/rate-enquiries/new">) {
  const user = await requirePagePermission("rfq.manage");
  const sp = await searchParams;
  const [suppliers, projects, locations, options] = await Promise.all([partyOptions(user, "supplier"), listProjectOptions(user, { forTaskCreation: true }), listLocationOptions(user), itemBrandOptions(user)]);
  const prId = str(sp.prId);
  const pre = prId ? await prefillRfqFromPr(user, prId) : null;
  const selected = str(sp.itemBrandId) ? options.find((o) => o.id === sp.itemBrandId) : undefined;
  const lines = pre
    ? pre.lines.map((l) => ({ key: newId(), itemBrandId: l.itemBrandId, quantity: l.quantity, acceptableBrands: "", specifications: l.specifications, prLineId: l.prLineId }))
    : selected
      ? [{ key: newId(), itemBrandId: selected.id, quantity: str(sp.qty) ?? "", acceptableBrands: "", specifications: "", prLineId: null }]
      : [];
  const projectId = pre?.projectId ?? str(sp.projectId);
  const lockProject = !!projectId && projects.some((p) => p.id === projectId);
  const project = projects.find((p) => p.id === projectId);
  return (
    <>
      <PageHeader
        title="New rate enquiry"
        description="Ask several suppliers for prices on the same materials, then compare their quotations side by side."
        breadcrumbs={docCrumbs(lockProject ? project : null, "rate-enquiries", { label: "New enquiry" })}
      />
      <RfqForm
        suppliers={suppliers}
        projects={projects}
        locations={locations}
        options={options}
        lockProject={lockProject}
        prNumber={pre?.prNumber ?? null}
        initial={{ projectId: lockProject ? projectId : null, prId: pre?.prId ?? null, title: pre?.title ?? (project && selected ? `${selected.itemName} for ${project.name}` : ""), deliveryLocationId: pre?.deliveryLocationId ?? null, requiredBy: pre?.requiredBy ?? "", responseDue: addDays(todayString(), 3), supplierIds: pre?.supplierIds ?? [], lines }}
      />
    </>
  );
}
