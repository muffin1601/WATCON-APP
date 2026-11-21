import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { payablesCrumbs } from "@/components/payables/crumbs";
import { NoteForm } from "@/components/payables/note-ui";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions/definitions";
import { noteTargets } from "@/modules/payables/notes";
import { listProjectOptions } from "@/modules/projects/service";
import { startOfToday } from "@/modules/tasks/rules";

export const metadata: Metadata = { title: "New credit / debit note" };

const id = (v: string | string[] | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

export default async function NewNotePage({ searchParams }: PageProps<"/notes/new">) {
  const user = await requireUser();
  if (!can(user, "bills.manage") && !can(user, "invoice.manage")) redirect("/dashboard?denied=1");
  const sp = await searchParams;
  const lockedProjectId = id(sp.projectId);
  const [{ bills, invoices }, projects] = await Promise.all([noteTargets(user, lockedProjectId), lockedProjectId ? listProjectOptions(user, { forTaskCreation: true }) : Promise.resolve([])]);
  const project = projects.find((p) => p.id === lockedProjectId) ?? null;
  const billId = id(sp.billId);
  const invoiceId = id(sp.invoiceId);
  return (
    <>
      <PageHeader title="New credit / debit note" description={`${project ? `For project ${project.code} – ${project.name}. ` : ""}The note is saved as a draft; it reduces the balance only after an approver approves it.`} breadcrumbs={project ? payablesCrumbs(project, "notes", "New note") : [{ label: "Credit & debit notes", href: "/notes" }, { label: "New" }]} />
      <NoteForm bills={bills} invoices={invoices} initialBillId={billId && bills.some((b) => b.id === billId) ? billId : null} initialInvoiceId={invoiceId && invoices.some((i) => i.id === invoiceId) ? invoiceId : null} today={startOfToday().toISOString().slice(0, 10)} />
    </>
  );
}
