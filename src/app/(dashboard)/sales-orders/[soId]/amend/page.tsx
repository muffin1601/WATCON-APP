import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { SoForm } from "@/components/sales/so-form";
import { soInitial, soLines } from "@/components/sales/so-initial";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getCommercialSettings } from "@/modules/commercial/core";
import { itemBrandOptions } from "@/modules/inventory/locations";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";
import { clientPoOptions } from "@/modules/sales/client-po";
import { getSalesOrder } from "@/modules/sales/sales-order";

export const metadata: Metadata = { title: "Request sales order amendment" };

export default async function AmendSalesOrderPage({ params }: PageProps<"/sales-orders/[soId]/amend">) {
  const user = await requirePagePermission("so.manage");
  const { soId } = await params;
  const { so, can } = await orNotFound(getSalesOrder(user, soId));
  if (!can.requestAmendment) redirect(`/sales-orders/${so.id}${can.edit ? "/edit" : "#amendments"}`);
  const [clients, projects, clientPos, options, settings] = await Promise.all([partyOptions(user, "client"), listProjectOptions(user), clientPoOptions(user, { projectId: so.projectId }), itemBrandOptions(user), getCommercialSettings(user.organizationId)]);
  return (
    <>
      <PageHeader title={`Request amendment · ${so.number}`} description="Nothing changes until a Super Admin approves the request." breadcrumbs={[...projectCrumbs(so.project, "sales-orders"), { label: so.number, href: `/sales-orders/${so.id}` }, { label: "Request amendment" }]} />
      <SoForm mode="amend" lockProject soId={so.id} initial={soInitial(so)} original={soLines(so.lines)} projects={projects} clients={clients} clientPos={clientPos} options={options} companyStateCode={settings.stateCode} />
    </>
  );
}
