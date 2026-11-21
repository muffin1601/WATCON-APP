import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { SoForm } from "@/components/sales/so-form";
import { soInitial } from "@/components/sales/so-initial";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getCommercialSettings } from "@/modules/commercial/core";
import { itemBrandOptions } from "@/modules/inventory/locations";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";
import { clientPoOptions } from "@/modules/sales/client-po";
import { getSalesOrder } from "@/modules/sales/sales-order";

export const metadata: Metadata = { title: "Edit sales order" };

export default async function EditSalesOrderPage({ params }: PageProps<"/sales-orders/[soId]/edit">) {
  const user = await requirePagePermission("so.manage");
  const { soId } = await params;
  const { so, can } = await orNotFound(getSalesOrder(user, soId));
  // An approved order is locked for everyone: the only way to change it is an amendment request.
  if (!can.edit) redirect(can.requestAmendment ? `/sales-orders/${so.id}/amend` : `/sales-orders/${so.id}`);
  const [clients, projects, clientPos, options, settings] = await Promise.all([partyOptions(user, "client"), listProjectOptions(user, { forTaskCreation: true }), clientPoOptions(user, { projectId: so.projectId }), itemBrandOptions(user), getCommercialSettings(user.organizationId)]);
  return (
    <>
      <PageHeader title={`Edit ${so.number}`} breadcrumbs={[...projectCrumbs(so.project, "sales-orders"), { label: so.number, href: `/sales-orders/${so.id}` }, { label: "Edit" }]} />
      <SoForm mode="edit" lockProject soId={so.id} version={so.version} initial={soInitial(so)} projects={projects} clients={clients} clientPos={clientPos} options={options} companyStateCode={settings.stateCode} />
    </>
  );
}
