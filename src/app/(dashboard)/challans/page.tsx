import { listCrumbs, lockedProject } from "@/components/procurement/crumbs";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCards } from "@/components/commercial/ui";
import { ChallanTable } from "@/components/stores/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { listProjectOptions } from "@/modules/projects/service";
import { CHALLAN_TYPE_LABELS, CHALLAN_TYPES, listChallans } from "@/modules/stores/challan";

export const metadata: Metadata = { title: "Challans" };

const STATUSES = ["DRAFT", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "DELIVERED", "CLOSED", "CANCELLED"];

export default async function ChallansPage({ searchParams }: PageProps<"/challans">) {
  const user = await requirePagePermission("grn.view");
  const sp = await searchParams;
  const projectId = typeof sp.projectId === "string" ? sp.projectId : undefined;
  const [result, projects] = await Promise.all([listChallans(user, sp), listProjectOptions(user)]);
  const locked = lockedProject(projects, sp);
  const n = (k: string) => result.byStatus[k] ?? 0;
  const q = (extra: string) => `/challans?${projectId ? `projectId=${projectId}&` : ""}${extra}`;
  return (
    <>
      <PageHeader
        title="Challans"
        description="Material movements between the store, sites, suppliers and clients — every one tied to a project."
        breadcrumbs={listCrumbs(locked, "challans")}
        actions={
          can(user, "stock.transfer") && (
            <Button asChild size="sm">
              <Link href={`/challans/new${projectId ? `?projectId=${projectId}` : ""}`}>
                <Plus /> New challan
              </Link>
            </Button>
          )
        }
      />
      <FilterBar params={["projectId", "q", "status", "type"]}>
        {!locked && <FilterSelect param="projectId" label="Project" allLabel="All my projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />}
        <SearchInput placeholder="Search challan, vehicle or party…" />
        <FilterSelect param="type" label="Type" options={CHALLAN_TYPES.map((t) => ({ value: t, label: CHALLAN_TYPE_LABELS[t] }))} />
        <FilterSelect param="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s === "DISPATCHED" ? "in transit" : s.replace(/_/g, " ").toLowerCase() }))} />
      </FilterBar>
      <SummaryCards
        items={[
          { label: "Drafts – not dispatched", value: n("DRAFT"), href: q("status=DRAFT") },
          { label: "In transit", value: n("DISPATCHED"), tone: n("DISPATCHED") ? "warn" : "default", href: q("status=DISPATCHED") },
          { label: "Partially received", value: n("PARTIALLY_RECEIVED"), tone: n("PARTIALLY_RECEIVED") ? "warn" : "default", href: q("status=PARTIALLY_RECEIVED") },
          { label: "Received / delivered", value: n("RECEIVED") + n("DELIVERED"), tone: "good", href: q("status=RECEIVED") },
          { label: "Closed", value: n("CLOSED"), href: q("status=CLOSED") },
        ]}
      />
      <ChallanTable
        rows={result.rows.map((r) => ({
          id: r.id,
          number: r.number,
          type: r.type,
          typeLabel: CHALLAN_TYPE_LABELS[r.type],
          status: r.status,
          date: r.dispatchDate?.toISOString() ?? null,
          project: r.project,
          from: r.fromLocation?.name ?? "—",
          to: r.toLocation?.name ?? r.party?.name ?? "—",
          vehicleNo: r.vehicleNo,
          lines: r._count.lines,
        }))}
      />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
