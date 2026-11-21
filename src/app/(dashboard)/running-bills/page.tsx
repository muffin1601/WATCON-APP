import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCards } from "@/components/commercial/ui";
import { RaTable } from "@/components/sales/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatINRCompact } from "@/lib/money";
import { can } from "@/lib/permissions/definitions";
import { listProjectOptions } from "@/modules/projects/service";
import { listRaBills } from "@/modules/sales/ra-bill";

export const metadata: Metadata = { title: "Running bills" };

const STATUSES = ["DRAFT", "INTERNAL_REVIEW", "SUBMITTED", "DISPUTED", "CLIENT_CERTIFIED", "INVOICED", "PARTIALLY_PAID", "PAID", "CANCELLED"];

export default async function RunningBillsPage({ searchParams }: PageProps<"/running-bills">) {
  const user = await requirePagePermission("rabill.view");
  const sp = await searchParams;
  const [result, projects] = await Promise.all([listRaBills(user, sp), listProjectOptions(user)]);
  const b = result.byStatus;
  const n = (...k: string[]) => k.reduce((a, s) => a + (b[s]?.count ?? 0), 0);
  const certified = ["CLIENT_CERTIFIED", "INVOICED", "PARTIALLY_PAID", "PAID"].reduce((a, k) => a + Number(b[k]?.certified ?? 0), 0);
  const projectId = typeof sp.projectId === "string" ? sp.projectId : undefined;
  return (
    <>
      <PageHeader
        title="Running bills"
        description="Progress bills (RA bills) raised against client POs: claim, client certification, then invoice."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Running bills" }]}
        actions={
          can(user, "rabill.manage") && (
            <Button asChild size="sm">
              <Link href={`/running-bills/new${projectId ? `?projectId=${projectId}` : ""}`}>
                <Plus /> New running bill
              </Link>
            </Button>
          )
        }
      />
      <SummaryCards
        items={[
          { label: "Drafts / in review", value: n("DRAFT", "INTERNAL_REVIEW"), href: "/running-bills?status=DRAFT" },
          { label: "With client", value: n("SUBMITTED"), href: "/running-bills?status=SUBMITTED" },
          { label: "Disputed", value: n("DISPUTED"), tone: n("DISPUTED") ? "bad" : "default", href: "/running-bills?status=DISPUTED" },
          { label: "Certified, to invoice", value: n("CLIENT_CERTIFIED"), tone: n("CLIENT_CERTIFIED") ? "warn" : "default", href: "/running-bills?status=CLIENT_CERTIFIED" },
          { label: "Certified value", value: formatINRCompact(certified.toFixed(2)) },
        ]}
      />
      <FilterBar params={["projectId", "q", "status"]}>
        <FilterSelect param="projectId" label="Project" allLabel="All my projects" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />
        <SearchInput placeholder="Search bill, client or contract…" />
        <FilterSelect param="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").toLowerCase() }))} />
      </FilterBar>
      <RaTable rows={result.rows} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
