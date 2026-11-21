import type { Metadata } from "next";
import Link from "next/link";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { RaForm } from "@/components/sales/ra-ui";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { todayString } from "@/modules/inventory/serialize";
import { listProjectOptions } from "@/modules/projects/service";
import { clientPoOptions } from "@/modules/sales/client-po";
import { raPrefill } from "@/modules/sales/ra-bill";

export const metadata: Metadata = { title: "New running bill" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function NewRunningBillPage({ searchParams }: PageProps<"/running-bills/new">) {
  const user = await requirePagePermission("rabill.manage");
  const sp = await searchParams;
  const clientPoId = str(sp.clientPoId);
  if (!clientPoId) {
    // A running bill is always against one client PO: pick it (scoped to the project when given).
    const projectId = str(sp.projectId);
    const [pos, projects] = await Promise.all([clientPoOptions(user, projectId ? { projectId } : {}), listProjectOptions(user)]);
    const project = projects.find((p) => p.id === projectId);
    return (
      <>
        <PageHeader title="New running bill" description="Choose the client PO this bill is raised against." breadcrumbs={[...projectCrumbs(project, "running-bills", { label: "Running bills", href: "/running-bills" }), { label: "New running bill" }]} />
        {pos.length === 0 ? (
          <EmptyState title="No active client PO" description="Running bills need an approved (active) client PO. Record and approve the client's PO first." />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {pos.map((p) => (
              <li key={p.id}>
                <Link href={`/running-bills/new?clientPoId=${p.id}`} className="flex flex-col px-4 py-3 text-sm hover:bg-muted/40">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  const pre = await orNotFound(raPrefill(user, clientPoId));
  const projects = await listProjectOptions(user);
  const proj = projects.find((p) => p.code === pre.clientPo.project.code) ?? null;
  return (
    <>
      <PageHeader title={`New running bill RA-${pre.nextRa}`} description={`${pre.clientPo.clientPoNumber} · ${pre.clientPo.party}`} breadcrumbs={[...projectCrumbs(proj, "running-bills", { label: "Running bills", href: "/running-bills" }), { label: "New running bill" }]} />
      {pre.pendingBills > 0 && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{pre.pendingBills} earlier bill{pre.pendingBills === 1 ? " is" : "s are"} still open on this contract. Quantities already claimed are shown as billed.</p>}
      <RaForm clientPoId={pre.clientPo.id} lines={pre.lines} terms={{ retentionPct: pre.clientPo.retentionPct, advanceRecoveryPct: pre.clientPo.advanceRecoveryPct }} initial={{ billDate: todayString(), periodFrom: pre.periodFrom, periodTo: todayString(), otherDeductions: "", deductionNotes: "", remarks: "", claims: {} }} />
    </>
  );
}
