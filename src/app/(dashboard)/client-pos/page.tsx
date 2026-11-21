import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCards } from "@/components/commercial/ui";
import { CpoTable } from "@/components/sales/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatINRCompact } from "@/lib/money";
import { can } from "@/lib/permissions/definitions";
import { partyOptions } from "@/modules/parties/service";
import { listProjectOptions } from "@/modules/projects/service";
import { listClientPos } from "@/modules/sales/client-po";

export const metadata: Metadata = { title: "Client POs" };

const STATUSES = ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "REJECTED", "COMPLETED", "CLOSED", "CANCELLED"];

export default async function ClientPosPage({ searchParams }: PageProps<"/client-pos">) {
  const user = await requirePagePermission("cpo.view");
  const sp = await searchParams;
  const [result, projects, clients] = await Promise.all([listClientPos(user, sp), listProjectOptions(user), partyOptions(user, "client")]);
  const b = result.byStatus;
  const n = (k: string) => b[k]?.count ?? 0;
  const active = Number(b.ACTIVE?.total ?? 0) + Number(b.COMPLETED?.total ?? 0);
  const projectId = typeof sp.projectId === "string" ? sp.projectId : undefined;
  return (
    <>
      <PageHeader
        title="Client POs"
        description="Contracts and work orders received from clients, with the quantities you may bill."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Client POs" }]}
        actions={
          can(user, "cpo.manage") && (
            <Button asChild size="sm">
              <Link href={`/client-pos/new${projectId ? `?projectId=${projectId}` : ""}`}>
                <Plus /> New client PO
              </Link>
            </Button>
          )
        }
      />
      <SummaryCards
        items={[
          { label: "Drafts", value: n("DRAFT") + n("REJECTED"), href: "/client-pos?status=DRAFT" },
          { label: "Pending approval", value: n("PENDING_APPROVAL"), tone: n("PENDING_APPROVAL") ? "warn" : "default", href: "/client-pos?status=PENDING_APPROVAL" },
          { label: "Active contracts", value: n("ACTIVE"), href: "/client-pos?status=ACTIVE" },
          { label: "Contract value", value: formatINRCompact(active.toFixed(2)), hint: "active and completed" },
        ]}
      />
      <FilterBar params={["projectId", "q", "status", "partyId"]}>
        <FilterSelect param="projectId" label="Project" allLabel="All my projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />
        <SearchInput placeholder="Search contract, client or item…" />
        <FilterSelect param="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))} />
        <FilterSelect param="partyId" label="Client" options={clients.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterBar>
      <CpoTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
