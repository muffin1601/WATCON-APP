import type { Metadata } from "next";
import { PrForm } from "@/components/procurement/pr-ui";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { itemBrandOptions, listLocationOptions } from "@/modules/inventory/locations";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "New requisition" };

export default async function NewPrPage({ searchParams }: PageProps<"/purchase-requisitions/new">) {
  const user = await requirePagePermission("pr.create");
  const sp = await searchParams;
  const [projects, locations, options] = await Promise.all([listProjectOptions(user, { forTaskCreation: true }), listLocationOptions(user), itemBrandOptions(user)]);
  return (
    <>
      <PageHeader title="New purchase requisition" description="Tip: from Material planning you can select shortage lines and create a requisition with the exact quantities still to order." breadcrumbs={docCrumbs(projects.find((p) => p.id === sp.projectId), "requisitions", { label: "New requisition" })} />
      <PrForm lockProject={typeof sp.projectId === "string" && projects.some((p) => p.id === sp.projectId)} initial={{ projectId: typeof sp.projectId === "string" ? sp.projectId : null, deliveryLocationId: null, requiredBy: "", purpose: "", lines: [] }} projects={projects} locations={locations} options={options} />
    </>
  );
}
