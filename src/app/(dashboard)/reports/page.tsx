import { BarChart3, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocStatusBadge, Money } from "@/components/commercial/ui";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { DateRangeFilter, FilterBar, FilterSelect } from "@/components/tables/filters";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDate, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { availableReports, runReport, type Column, type ReportRow } from "@/modules/insights/reports";
import { listProjectOptions } from "@/modules/projects/service";

export const metadata: Metadata = { title: "Reports" };

const SHOW = 500;

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requirePagePermission("reports.commercial");
  const sp = await searchParams;
  const reports = availableReports(user);
  const key = typeof sp.r === "string" ? sp.r : undefined;
  const current = reports.find((r) => r.key === key);

  if (!current) {
    return (
      <>
        <PageHeader title="Reports" description="Commercial reports across the projects you can access. Open a report to filter it and download it as CSV (opens in Excel)." breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]} />
        {reports.length === 0 ? (
          <EmptyState icon={BarChart3} title="No reports available" description="Your role does not include access to any commercial module." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map((r) => (
              <Link key={r.key} href={`/reports?r=${r.key}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                <p className="flex items-center gap-2 font-medium">
                  <BarChart3 className="size-4 text-primary" aria-hidden /> {r.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-6 text-xs text-muted-foreground">Task reports (project, department and member task lists) are available from those pages&apos; print / export buttons.</p>
      </>
    );
  }

  const filters = { projectId: typeof sp.projectId === "string" ? sp.projectId : undefined, from: typeof sp.from === "string" ? sp.from : undefined, to: typeof sp.to === "string" ? sp.to : undefined };
  const [result, projects] = await Promise.all([runReport(user, current.key, filters), listProjectOptions(user)]);
  const qs = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1]));
  const csvHref = `/api/reports/csv/${current.key}${qs.size ? `?${qs}` : ""}`;
  const rows = result.rows.slice(0, SHOW);

  return (
    <>
      <PageHeader
        title={current.title}
        description={current.description}
        breadcrumbs={[{ label: "Reports", href: "/reports" }, { label: current.title }]}
        actions={
          <Button asChild size="sm">
            <a href={csvHref} download>
              <Download /> Download CSV
            </a>
          </Button>
        }
      />
      <FilterBar params={["projectId", "from", "to"]}>
        <FilterSelect param="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))} />
        {current.dated && <DateRangeFilter fromParam="from" toParam="to" label="Date" />}
      </FilterBar>
      <p className="mb-2 text-xs text-muted-foreground">
        {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
        {result.rows.length > SHOW ? ` · showing the first ${SHOW}; the CSV contains all rows` : ""}
      </p>
      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No rows" description="Nothing matches these filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {result.def.columns.map((c) => (
                  <th key={c.key} className={cn("px-3 py-2 font-medium whitespace-nowrap", align(c))}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  {result.def.columns.map((c, ci) => (
                    <td key={c.key} className={cn("px-3 py-1.5 whitespace-nowrap", align(c))}>
                      <Cell row={r} col={c} link={ci === 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const align = (c: Column) => (c.type === "money" || c.type === "qty" || c.type === "int" ? "text-right" : "text-left");

function Cell({ row, col, link }: { row: ReportRow; col: Column; link: boolean }) {
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (link && row._href) {
    return (
      <Link href={row._href} className="font-medium hover:text-primary hover:underline">
        {String(v)}
      </Link>
    );
  }
  if (col.key === "status") return <DocStatusBadge status={String(v)} />;
  if (col.type === "money") return <Money value={String(v)} />;
  if (col.type === "qty") return <span className="tabular-nums">{formatQty(String(v))}</span>;
  if (col.type === "date") return <>{formatDate(String(v))}</>;
  return <>{String(v)}</>;
}
