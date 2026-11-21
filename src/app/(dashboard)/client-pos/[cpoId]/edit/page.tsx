import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { CpoForm } from "@/components/sales/cpo-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getCommercialSettings } from "@/modules/commercial/core";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";
import { cpoFormValues, getClientPo } from "@/modules/sales/client-po";

export const metadata: Metadata = { title: "Edit client PO" };

export default async function EditClientPoPage({ params }: PageProps<"/client-pos/[cpoId]/edit">) {
  const user = await requirePagePermission("cpo.manage");
  const { cpoId } = await params;
  const { cpo, can } = await orNotFound(getClientPo(user, cpoId));
  if (!can.edit) redirect(`/client-pos/${cpo.id}`);
  const [clients, projects, settings] = await Promise.all([partyOptions(user, "client"), listProjectOptions(user, { forTaskCreation: true }), getCommercialSettings(user.organizationId)]);
  return (
    <>
      <PageHeader title={`Edit ${cpo.clientPoNumber}`} breadcrumbs={[...projectCrumbs(cpo.project, "client-pos"), { label: cpo.number, href: `/client-pos/${cpo.id}` }, { label: "Edit" }]} />
      <CpoForm lockProject cpoId={cpo.id} version={cpo.version} revision={cpo.revision} initial={cpoFormValues(cpo)} projects={projects} clients={clients} companyStateCode={settings.stateCode} />
    </>
  );
}
