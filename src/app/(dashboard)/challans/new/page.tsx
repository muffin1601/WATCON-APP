import type { Metadata } from "next";
import { ChallanForm, type ChallanType } from "@/components/stores/challan-form";
import { docCrumbs } from "@/components/procurement/crumbs";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { itemBrandOptions, listLocationOptions } from "@/modules/inventory/locations";
import { todayString } from "@/modules/inventory/serialize";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";
import { CHALLAN_TYPES, challanFormData } from "@/modules/stores/challan";

export const metadata: Metadata = { title: "New challan" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

export default async function NewChallanPage({ searchParams }: PageProps<"/challans/new">) {
  const user = await requirePagePermission("stock.transfer");
  const sp = await searchParams;
  const [projects, locations, options, suppliers, clients, data] = await Promise.all([listProjectOptions(user, { forTaskCreation: true }), listLocationOptions(user), itemBrandOptions(user), partyOptions(user, "supplier"), partyOptions(user, "client"), challanFormData(user)]);
  const type = (CHALLAN_TYPES as readonly string[]).includes(str(sp.type) ?? "") ? (sp.type as ChallanType) : "ISSUE_TO_SITE";
  const soId = str(sp.soId);
  const so = soId ? data.sos.find((s) => s.id === soId) : undefined;
  const projectId = str(sp.projectId) ?? so?.projectId ?? null;
  const lockProject = !!projectId && projects.some((p) => p.id === projectId);
  return (
    <>
      <PageHeader title="New challan" description="Saved as a draft. Stock moves only when you dispatch it." breadcrumbs={docCrumbs(lockProject ? projects.find((p) => p.id === projectId) : null, "challans", { label: "New challan" })} />
      <ChallanForm
        initial={{ type: soId ? "CLIENT_DELIVERY" : type, projectId: lockProject ? projectId : null, itemBrandId: str(sp.itemBrandId), qty: str(sp.qty) ?? "", soId: so && so.projectId === projectId ? so.id : null }}
        lockProject={lockProject}
        projects={projects}
        locations={locations}
        options={options}
        suppliers={suppliers}
        clients={clients}
        data={data}
        today={todayString()}
      />
    </>
  );
}
