import { listCrumbs, lockedProject } from "@/components/procurement/crumbs";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCards } from "@/components/commercial/ui";
import { PoTable } from "@/components/procurement/tables";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { formatINRCompact } from "@/lib/money";
import { partyOptions } from "@/modules/parties/service";
import { listPos } from "@/modules/procurement/po";
import { listProjectOptions } from "@/modules/projects/service";
import { startOfToday } from "@/modules/tasks/rules";

export const metadata: Metadata = { title: "Purchase orders" };

const PO_STATUS_OPTIONS = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"];

export default async function PurchaseOrdersPage({ searchParams }: PageProps<"/purchase-orders">) {
  const user = await requirePagePermission("po.view");
  const sp = await searchParams;
  const [result, projects, suppliers] = await Promise.all([listPos(user, sp), listProjectOptions(user), partyOptions(user, "supplier")]);
  const locked = lockedProject(projects, sp);
  const b = result.byStatus;
  const n = (k: string) => b[k]?.count ?? 0;
  const today = startOfToday();
  const committed = ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED"].reduce((a, k) => a + Number(b[k]?.total ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Supplier orders, each raised for one project."
        breadcrumbs={listCrumbs(locked, "purchase-orders")}
        actions={
          can(user, "po.create") && (
            <Button asChild size="sm">
              <Link href={`/purchase-orders/new${typeof sp.projectId === "string" ? `?projectId=${sp.projectId}` : ""}`}>
                <Plus /> New purchase order
              </Link>
            </Button>
          )
        }
      />
      <SummaryCards
        items={[
          { label: "Drafts", value: n("DRAFT") + n("REJECTED"), href: "/purchase-orders?status=DRAFT" },
          { label: "Pending approval", value: n("PENDING_APPROVAL"), tone: n("PENDING_APPROVAL") ? "warn" : "default", href: "/purchase-orders?status=PENDING_APPROVAL" },
          { label: "Open for delivery", value: n("APPROVED") + n("SENT") + n("ACKNOWLEDGED") + n("PARTIALLY_RECEIVED"), href: "/purchase-orders?pending=1" },
          { label: "Partially received", value: n("PARTIALLY_RECEIVED"), href: "/purchase-orders?status=PARTIALLY_RECEIVED" },
          { label: "Fully received", value: n("FULLY_RECEIVED"), tone: "good", href: "/purchase-orders?status=FULLY_RECEIVED" },
          { label: "Committed value", value: formatINRCompact(committed.toFixed(2)), hint: "approved and later" },
        ]}
      />
      <FilterBar params={["projectId", "q", "status", "partyId", "pending", "from", "to"]}>{!locked && <FilterSelect param="projectId" label="Project" allLabel="All my projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />}
        <SearchInput placeholder="Search PO, supplier or item…" />
        <FilterSelect param="status" label="Status" options={PO_STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))} />
        <FilterSelect param="partyId" label="Supplier" options={suppliers.map((p) => ({ value: p.id, label: p.name }))} />
        <DateRangeFilter fromParam="from" toParam="to" label="Order date" />
      </FilterBar>
      <p className="mb-2 text-xs text-muted-foreground">
        {result.total} orders · {formatINRCompact(result.filteredValue)} in the current view
      </p>
      <PoTable rows={result.rows.map((r) => ({ id: r.id, number: r.number, revision: r.revision, status: r.status, orderDate: r.orderDate.toISOString(), expectedDate: r.expectedDate?.toISOString() ?? null, total: r.total, party: r.party, project: r.project, overdue: !!r.expectedDate && r.expectedDate < today && ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(r.status) }))} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
