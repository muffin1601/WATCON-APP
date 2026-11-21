import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceForm } from "@/components/sales/invoice-form";
import { projectCrumbs } from "@/components/projects/project-breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requirePagePermission } from "@/lib/auth/session";
import { taxModeFor } from "@/lib/money";
import { orNotFound } from "@/lib/pages";
import { getCommercialSettings } from "@/modules/commercial/core";
import { listProjectOptions } from "@/modules/projects/service";
import { clientPoOptions } from "@/modules/sales/client-po";
import { defaultDueDate, invoicePrefill } from "@/modules/sales/invoice";
import { salesOrderOptions } from "@/modules/sales/sales-order";

export const metadata: Metadata = { title: "New client invoice" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function NewInvoicePage({ searchParams }: PageProps<"/client-invoices/new">) {
  const user = await requirePagePermission("invoice.manage");
  const sp = await searchParams;
  const raBillId = str(sp.raBillId);
  const soId = str(sp.soId);
  const clientPoId = str(sp.clientPoId);
  const projects = await listProjectOptions(user);
  if (!raBillId && !soId && !clientPoId) {
    // An invoice is always raised from something: a certified running bill, a delivered order or a contract.
    const projectId = str(sp.projectId);
    const [orders, pos] = await Promise.all([salesOrderOptions(user, projectId ? { projectId } : {}), clientPoOptions(user, projectId ? { projectId } : {})]);
    const project = projects.find((p) => p.id === projectId);
    return (
      <>
        <PageHeader title="New client invoice" description="Choose what you are invoicing. For work-based billing, open the certified running bill and use Create invoice." breadcrumbs={[...projectCrumbs(project, "invoices", { label: "Client invoices", href: "/client-invoices" }), { label: "New invoice" }]} />
        {orders.length + pos.length === 0 ? (
          <EmptyState title="Nothing to invoice yet" description="Approve a sales order or client PO first." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "Sales orders (supply)", items: orders.map((o) => ({ ...o, href: `/client-invoices/new?soId=${o.id}` })) },
              { title: "Client POs (contract)", items: pos.map((o) => ({ ...o, href: `/client-invoices/new?clientPoId=${o.id}` })) },
            ].map((g) => (
              <section key={g.title}>
                <h2 className="mb-2 text-sm font-semibold">{g.title}</h2>
                <ul className="divide-y rounded-xl border bg-card">
                  {g.items.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">None</li>}
                  {g.items.map((o) => (
                    <li key={o.id}>
                      <Link href={o.href} className="flex flex-col px-4 py-3 text-sm hover:bg-muted/40">
                        <span className="font-medium">{o.label}</span>
                        <span className="text-xs text-muted-foreground">{o.hint}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </>
    );
  }
  const [pre, settings] = await Promise.all([orNotFound(invoicePrefill(user, { raBillId, soId, clientPoId })), getCommercialSettings(user.organizationId)]);
  if (!pre) return null;
  const project = projects.find((p) => p.id === pre.project.id) ?? null;
  const due = defaultDueDate(pre.paymentTermsDays);
  return (
    <>
      <PageHeader title={`New invoice · ${pre.title}`} description={pre.party} breadcrumbs={[...projectCrumbs(project, "invoices", { label: "Client invoices", href: "/client-invoices" }), { label: "New invoice" }]} />
      {!pre.ready ? <EmptyState title="Cannot invoice yet" description={pre.blocker ?? "This document is not ready to be invoiced."} /> : <InvoiceForm source={pre.source} sourceId={pre.id} lines={pre.lines} deductions={pre.deductions} taxMode={taxModeFor(settings.stateCode, pre.partyState)} defaultDue={due} />}
    </>
  );
}
