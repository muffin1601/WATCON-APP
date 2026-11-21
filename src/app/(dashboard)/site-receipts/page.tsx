import { listCrumbs, lockedProject } from "@/components/procurement/crumbs";
import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Section, SummaryCards } from "@/components/commercial/ui";
import { GrnTable, PendingDeliveries } from "@/components/stores/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { listProjectOptions } from "@/modules/projects/service";
import { listGrns, pendingDeliveries } from "@/modules/stores/grn";

export const metadata: Metadata = { title: "Site receipts" };

const STATUSES = ["DRAFT", "SUBMITTED", "POSTED", "REJECTED", "CANCELLED", "REVERSED"];

export default async function SiteReceiptsPage({ searchParams }: PageProps<"/site-receipts">) {
  const user = await requirePagePermission("grn.view");
  const sp = await searchParams;
  const projectId = typeof sp.projectId === "string" ? sp.projectId : undefined;
  const [result, pending, projects] = await Promise.all([listGrns(user, sp), pendingDeliveries(user, projectId), listProjectOptions(user)]);
  const locked = lockedProject(projects, sp);
  const n = (k: string) => result.byStatus[k] ?? 0;
  const q = (extra: string) => `/site-receipts?${projectId ? `projectId=${projectId}&` : ""}${extra}`;
  return (
    <>
      <PageHeader
        title="Site receipts"
        description="Record material that arrives at site. Accepted quantities are added to the site's stock after verification."
        breadcrumbs={listCrumbs(locked, "site-receipts")}
        actions={
          // Receipts start from a delivery in the "Waiting to be received" list below; this
          // button is for sending material out, so say so plainly.
          can(user, "stock.transfer") && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/challans/new${projectId ? `?projectId=${projectId}` : ""}`}>
                <Truck /> Send material (challan)
              </Link>
            </Button>
          )
        }
      />
      <FilterBar params={["projectId", "q", "status"]}>
        {!locked && <FilterSelect param="projectId" label="Project" allLabel="All my projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />}
        <SearchInput placeholder="Search receipt, PO, challan or supplier…" />
        <FilterSelect param="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))} />
      </FilterBar>
      <Section title={`Waiting to be received (${pending.length})`} className="mb-6">
        <PendingDeliveries items={pending} canReceive={can(user, "grn.create")} />
      </Section>
      <SummaryCards
        items={[
          { label: "Drafts", value: n("DRAFT"), href: q("status=DRAFT") },
          { label: "Awaiting verification", value: n("SUBMITTED"), tone: n("SUBMITTED") ? "warn" : "default", href: q("status=SUBMITTED") },
          { label: "Sent back", value: n("REJECTED"), tone: n("REJECTED") ? "bad" : "default", href: q("status=REJECTED") },
          { label: "Posted to stock", value: n("POSTED"), tone: "good", href: q("status=POSTED") },
          { label: "With damage / rejection", value: "View", href: q("discrepancy=1") },
        ]}
      />
      <GrnTable
        rows={result.rows.map((r) => ({
          id: r.id,
          number: r.number,
          status: r.status,
          receiptDate: r.receiptDate.toISOString(),
          project: r.project,
          source: r.po ? { kind: "po" as const, id: r.po.id, number: r.po.number } : r.challan ? { kind: "challan" as const, id: r.challan.id, number: r.challan.number } : null,
          from: r.party?.name ?? "Internal transfer",
          location: r.location.name,
          createdBy: r.createdBy.fullName,
          lines: r._count.lines,
          discrepancy: r.discrepancy,
        }))}
      />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
