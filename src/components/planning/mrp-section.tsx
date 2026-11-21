import { Plus } from "lucide-react";
import { SummaryCards } from "@/components/commercial/ui";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/modules/auth/service";
import { listLocationOptions } from "@/modules/inventory/locations";
import { listStockPositionOptions } from "@/modules/inventory/service";
import { getMrp, planningCapabilities } from "@/modules/planning/service";
import { listProjectOptions } from "@/modules/projects/service";
import { formatINRCompact } from "@/lib/money";
import { MrpTable, RequirementDialog } from "./mrp-table";

const STATUS_OPTIONS = [
  ["SHORTAGE", "Shortage"],
  ["LOW_STOCK", "Low stock"],
  ["AVAILABLE", "Available"],
  ["ALREADY_ORDERED", "Already ordered"],
  ["AWAITING_DELIVERY", "Awaiting delivery"],
  ["PARTIALLY_RECEIVED", "Partially received"],
  ["DELAYED", "Delayed"],
  ["FULLY_RECEIVED", "Fully received"],
  ["DAMAGED", "Damaged / rejected"],
  ["BELOW_REORDER", "Below reorder level"],
] as const;

/** Material planning for one project (project tab) or all accessible projects (global page). */
export async function MrpSection({ user, sp, projectId, basePath }: { user: SessionUser; sp: Record<string, string | string[] | undefined>; projectId?: string; basePath: string }) {
  const [mrp, positions, locations, projects] = await Promise.all([
    getMrp(user, { ...sp, projectId: projectId ?? sp.projectId }),
    listStockPositionOptions(user).then((p) => (p.length ? p : [])),
    listLocationOptions(user),
    listProjectOptions(user, { forTaskCreation: true }),
  ]);
  const caps = planningCapabilities(user);
  const s = mrp.summary;
  const href = (status: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}status=${status}`;
  const allPositions = positions.length ? positions : [];
  return (
    <section className="space-y-3" aria-label="Material planning">
      <SummaryCards
        items={[
          { label: "Requirement lines", value: s.total, href: basePath },
          { label: "Shortage / low stock", value: s.shortage, tone: s.shortage ? "bad" : "default", href: href("SHORTAGE") },
          { label: "Lines to order", value: s.toOrderLines, tone: s.toOrderLines ? "warn" : "default", hint: s.unpricedLines ? `${s.unpricedLines} without a price` : undefined },
          { label: "Awaiting delivery", value: s.awaiting, href: href("AWAITING_DELIVERY") },
          { label: "Delayed deliveries", value: s.delayed, tone: s.delayed ? "bad" : "default", href: href("DELAYED") },
          { label: "Est. procurement", value: formatINRCompact(s.estimatedCost), hint: "to order × last rate" },
        ]}
      />
      <FilterBar params={["q", "status", "view", ...(projectId ? [] : ["projectId"])]}>
        <SearchInput placeholder="Search item, brand or project…" />
        {!projectId && <FilterSelect param="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />}
        <FilterSelect param="status" label="Status" options={STATUS_OPTIONS.map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="view" label="Requirements" allLabel="Open" options={[{ value: "all", label: "Include closed" }]} />
        {caps.canManage && (
          <div className="ml-auto">
            <RequirementDialog
              projects={projects}
              positions={allPositions}
              initial={projectId ? { projectId } : undefined}
              trigger={
                <Button size="sm">
                  <Plus /> Add requirement
                </Button>
              }
            />
          </div>
        )}
      </FilterBar>
      <MrpTable rows={mrp.rows} caps={caps} projects={projects} positions={allPositions} locations={locations} showProject={!projectId} />
    </section>
  );
}
