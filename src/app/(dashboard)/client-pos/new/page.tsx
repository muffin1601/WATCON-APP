import type { Metadata } from "next";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { CpoForm, type CpoFormValues } from "@/components/sales/cpo-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getCommercialSettings } from "@/modules/commercial/core";
import { todayString } from "@/modules/inventory/serialize";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "New client PO" };

export default async function NewClientPoPage({ searchParams }: PageProps<"/client-pos/new">) {
  const user = await requirePagePermission("cpo.manage");
  const sp = await searchParams;
  const [clients, projects, settings] = await Promise.all([partyOptions(user, "client"), listProjectOptions(user, { forTaskCreation: true }), getCommercialSettings(user.organizationId)]);
  const projectId = typeof sp.projectId === "string" && projects.some((p) => p.id === sp.projectId) ? sp.projectId : null;
  const initial: CpoFormValues = { projectId, partyId: null, clientPoNumber: "", poDate: todayString(), startDate: "", endDate: "", scope: "", paymentTerms: "", deliveryTerms: "", retentionPct: "", advanceAmount: "", advanceRecoveryPct: "", placeOfSupply: null, notes: "", lines: [], milestones: [] };
  const project = projects.find((p) => p.id === projectId);
  return (
    <>
      <PageHeader title="New client PO" description="Saved as a draft. Approve it to make it the active contract." breadcrumbs={[...projectCrumbs(project, "client-pos", { label: "Client POs", href: "/client-pos" }), { label: "New client PO" }]} />
      <CpoForm lockProject={!!project} initial={initial} projects={projects} clients={clients} companyStateCode={settings.stateCode} />
    </>
  );
}
