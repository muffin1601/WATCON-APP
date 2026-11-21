import { GitPullRequestArrow, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCards } from "@/components/commercial/ui";
import { PageHeader } from "@/components/shared/page-header";
import { SoTable } from "@/components/sales/tables";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatINRCompact } from "@/lib/money";
import { can } from "@/lib/permissions/definitions";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";
import { listSalesOrders } from "@/modules/sales/sales-order";

export const metadata: Metadata = { title: "Sales orders" };

const STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PARTIALLY_FULFILLED", "FULFILLED", "CLOSED", "CANCELLED"];

export default async function SalesOrdersPage({ searchParams }: PageProps<"/sales-orders">) {
  const user = await requirePagePermission("so.view");
  const sp = await searchParams;
  const [result, projects, clients] = await Promise.all([listSalesOrders(user, sp), listProjectOptions(user), partyOptions(user, "client")]);
  const b = result.byStatus;
  const n = (k: string) => b[k]?.count ?? 0;
  const live = ["APPROVED", "PARTIALLY_FULFILLED", "FULFILLED", "CLOSED"].reduce((a, k) => a + Number(b[k]?.total ?? 0), 0);
  const projectId = typeof sp.projectId === "string" ? sp.projectId : undefined;
  return (
    <>
      <PageHeader
        title="Sales orders"
        description="What each project has sold. An approved order is locked; changes go through an amendment request approved by a Super Admin."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sales orders" }]}
        actions={
          can(user, "so.manage") && (
            <Button asChild size="sm">
              <Link href={`/sales-orders/new${projectId ? `?projectId=${projectId}` : ""}`}>
                <Plus /> New sales order
              </Link>
            </Button>
          )
        }
      />
      {result.pendingAmendments > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <GitPullRequestArrow className="size-4" /> {result.pendingAmendments} amendment request{result.pendingAmendments === 1 ? "" : "s"} waiting for a Super Admin. Orders with a pending request are flagged in the list.
        </p>
      )}
      <SummaryCards
        items={[
          { label: "Drafts", value: n("DRAFT") + n("REJECTED"), href: "/sales-orders?status=DRAFT" },
          { label: "Pending approval", value: n("PENDING_APPROVAL"), tone: n("PENDING_APPROVAL") ? "warn" : "default", href: "/sales-orders?status=PENDING_APPROVAL" },
          { label: "Approved", value: n("APPROVED"), href: "/sales-orders?status=APPROVED" },
          { label: "In fulfilment", value: n("PARTIALLY_FULFILLED"), href: "/sales-orders?status=PARTIALLY_FULFILLED" },
          { label: "Fulfilled", value: n("FULFILLED"), tone: "good", href: "/sales-orders?status=FULFILLED" },
          { label: "Order book", value: formatINRCompact(live.toFixed(2)), hint: "approved and later" },
        ]}
      />
      <FilterBar params={["projectId", "q", "status", "partyId"]}>
        <FilterSelect param="projectId" label="Project" allLabel="All my projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />
        <SearchInput placeholder="Search order, client or item…" />
        <FilterSelect param="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))} />
        <FilterSelect param="partyId" label="Client" options={clients.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterBar>
      <SoTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
