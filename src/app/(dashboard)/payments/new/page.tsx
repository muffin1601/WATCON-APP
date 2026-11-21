import type { Metadata } from "next";
import { payablesCrumbs } from "@/components/payables/crumbs";
import { PaymentForm } from "@/components/payables/payment-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { partyOptions } from "@/modules/parties/service";
import { outstandingBills } from "@/modules/payables/bills";
import { outstandingInvoices, paymentDefaultsFor } from "@/modules/payables/payments";
import { listProjectOptions } from "@/modules/projects/service";
import { startOfToday } from "@/modules/tasks/rules";

export const metadata: Metadata = { title: "Record payment" };

const id = (v: string | string[] | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export default async function NewPaymentPage({ searchParams }: PageProps<"/payments/new">) {
  const user = await requirePagePermission("payments.manage");
  const sp = await searchParams;
  const direction = sp.direction === "IN" || id(sp.invoiceId) ? "IN" : "OUT";
  let partyId = id(sp.partyId);
  let projectId = id(sp.projectId);
  const preselect = id(sp.billId) ?? id(sp.invoiceId);
  // Opening from a bill / invoice: take its supplier / client and project.
  if (preselect && (!partyId || !projectId)) {
    const doc = await paymentDefaultsFor(user, direction, preselect);
    partyId ??= doc?.partyId ?? null;
    projectId ??= doc?.projectId ?? null;
  }
  const [parties, projects, openDocs] = await Promise.all([
    partyOptions(user, direction === "OUT" ? "supplier" : "client"),
    listProjectOptions(user, { forTaskCreation: true }),
    partyId && projectId ? (direction === "OUT" ? outstandingBills(user, partyId, projectId) : outstandingInvoices(user, partyId, projectId)) : Promise.resolve([]),
  ]);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const tab = direction === "OUT" ? "payments" : "receipts";
  const title = direction === "OUT" ? "Record supplier payment" : "Record client receipt";
  return (
    <>
      <PageHeader title={title} description={direction === "OUT" ? "Pay approved bills, or record an advance to set against bills later." : "Record money received against issued invoices, including TDS deducted by the client."} breadcrumbs={project ? payablesCrumbs(project, tab, "New") : [{ label: "Payments & receipts", href: `/payments?direction=${direction}` }, { label: "New" }]} />
      <PaymentForm
        key={`${partyId}-${projectId}`}
        direction={direction}
        partyId={partyId}
        projectId={projectId}
        parties={parties}
        projects={projects}
        openDocs={openDocs}
        preselect={preselect}
        lockProject={!!id(sp.projectId) && sp.pick !== "1"}
        today={startOfToday().toISOString().slice(0, 10)}
      />
    </>
  );
}
