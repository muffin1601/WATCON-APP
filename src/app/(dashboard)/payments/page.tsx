import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryCards } from "@/components/commercial/ui";
import { payablesCrumbs } from "@/components/payables/crumbs";
import { PaymentTable } from "@/components/payables/tables";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatINRCompact } from "@/lib/money";
import { can } from "@/lib/permissions/definitions";
import { cn } from "@/lib/utils";
import { partyOptions } from "@/modules/parties/service";
import { listPayments } from "@/modules/payables/payments";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Payments & receipts" };

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const user = await requirePagePermission("payments.view");
  const sp = await searchParams;
  const r = await listPayments(user, sp);
  const out = r.query.direction === "OUT";
  const [projects, parties] = await Promise.all([listProjectOptions(user), partyOptions(user, out ? "supplier" : "client")]);
  const project = projects.find((p) => p.id === r.query.projectId) ?? null;
  const projectQs = r.query.projectId ? `&projectId=${r.query.projectId}` : "";
  return (
    <>
      <PageHeader
        title="Payments & receipts"
        description="Money paid to suppliers and received from clients. Anything not yet set against a bill or invoice is shown as an advance."
        breadcrumbs={payablesCrumbs(project, out ? "payments" : "receipts")}
        actions={
          can(user, "payments.manage") && (
            <Button asChild size="sm">
              <Link href={`/payments/new?direction=${r.query.direction}${projectQs}`}>
                <Plus /> {out ? "Record supplier payment" : "Record client receipt"}
              </Link>
            </Button>
          )
        }
      />
      <div role="tablist" className="mb-5 flex gap-1 border-b">
        {(
          [
            ["OUT", "Paid out to suppliers"],
            ["IN", "Received from clients"],
          ] as const
        ).map(([d, label]) => (
          <Link key={d} role="tab" aria-selected={r.query.direction === d} href={`/payments?direction=${d}${projectQs}`} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", r.query.direction === d ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        ))}
      </div>
      <SummaryCards
        items={[
          { label: out ? "Payments" : "Receipts", value: r.summary.count },
          { label: out ? "Total paid" : "Total received", value: formatINRCompact(r.summary.gross) },
          { label: "Advances not yet allocated", value: formatINRCompact(r.summary.advance), tone: r.summary.advanceCount ? "warn" : "default", hint: `${r.summary.advanceCount} ${out ? "payment" : "receipt"}${r.summary.advanceCount === 1 ? "" : "s"}`, href: `/payments?direction=${r.query.direction}&advances=1${projectQs}` },
        ]}
      />
      <FilterBar params={project ? ["q", "partyId", "advances", "status"] : ["q", "projectId", "partyId", "advances", "status"]}>
        <SearchInput placeholder="Search number, reference or party…" />
        {!project && <FilterSelect param="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />}
        <FilterSelect param="partyId" label={out ? "Supplier" : "Client"} options={parties.map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect param="advances" label="Show" options={[{ value: "1", label: "With unallocated advance" }]} />
        <FilterSelect param="status" label="Status" options={[{ value: "POSTED", label: "posted" }, { value: "CANCELLED", label: "cancelled" }]} />
      </FilterBar>
      <PaymentTable rows={r.rows} direction={r.query.direction} />
      <Pagination total={r.total} page={r.page} pageSize={r.pageSize} />
    </>
  );
}
