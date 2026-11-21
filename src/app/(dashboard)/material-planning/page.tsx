import type { Metadata } from "next";
import { listCrumbs, lockedProject } from "@/components/procurement/crumbs";
import { MrpSection } from "@/components/planning/mrp-section";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Material planning" };

export default async function MaterialPlanningPage({ searchParams }: PageProps<"/material-planning">) {
  const user = await requirePagePermission("mrp.view");
  const sp = await searchParams;
  const locked = lockedProject(await listProjectOptions(user), sp);
  return (
    <>
      <PageHeader
        title="Material planning"
        description={locked ? `Requirements for ${locked.code} – ${locked.name}, each traced to its sales order, against stock, open orders and site receipts.` : "Project requirements against brand-wise stock, reservations, open orders, requisitions and site receipts — across all your projects."}
        breadcrumbs={listCrumbs(locked, "material-planning")}
      />
      <MrpSection user={user} sp={sp} projectId={locked?.id} basePath={locked ? `/material-planning?projectId=${locked.id}` : "/material-planning"} />
    </>
  );
}
