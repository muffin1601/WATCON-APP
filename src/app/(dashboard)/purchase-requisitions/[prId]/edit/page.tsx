import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrForm } from "@/components/procurement/pr-ui";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { itemBrandOptions, listLocationOptions } from "@/modules/inventory/locations";
import { getPr } from "@/modules/procurement/pr";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Edit requisition" };

export default async function EditPrPage({ params }: PageProps<"/purchase-requisitions/[prId]/edit">) {
  const user = await requirePagePermission("pr.create");
  const { prId } = await params;
  const { pr, can } = await orNotFound(getPr(user, prId));
  if (!can.edit) redirect(`/purchase-requisitions/${pr.id}`);
  const [projects, locations, options] = await Promise.all([listProjectOptions(user, { forTaskCreation: true }), listLocationOptions(user), itemBrandOptions(user)]);
  return (
    <>
      <PageHeader title={`Edit ${pr.number}`} breadcrumbs={docCrumbs(pr.project, "requisitions", { label: pr.number, href: `/purchase-requisitions/${pr.id}` }, { label: "Edit" })} />
      <PrForm
        prId={pr.id}
        version={pr.version}
        projects={projects}
        locations={locations}
        options={options}
        initial={{ projectId: pr.projectId, deliveryLocationId: pr.deliveryLocationId, requiredBy: pr.requiredBy?.toISOString().slice(0, 10) ?? "", purpose: pr.purpose ?? "", lines: pr.lines.map((l) => ({ key: l.id, itemBrandId: l.itemBrandId, description: l.notes ?? "", quantity: l.quantity, rate: "", discountPct: "0", gstRate: "0", links: { requirementId: l.requirementId } })) }}
      />
    </>
  );
}
