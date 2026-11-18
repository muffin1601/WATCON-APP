import type { Metadata } from "next";
import { PrintReportLayout } from "@/components/reports/print-report-layout";
import { PrintToolbar } from "@/components/reports/print-toolbar";
import { requireUser } from "@/lib/auth/session";
import { orNotFound } from "@/lib/pages";
import { getReport } from "@/modules/reports/service";

export const metadata: Metadata = { title: "Print report" };

export default async function PrintReportPage({ searchParams }: PageProps<"/reports/print">) {
  const user = await requireUser();
  const report = await orNotFound(getReport(user, await searchParams));
  return (
    <div className="min-h-screen bg-neutral-100 py-6 print:bg-white print:py-0">
      <PrintToolbar />
      <div className="mx-auto max-w-[210mm] shadow-sm print:shadow-none">
        <PrintReportLayout report={report} />
      </div>
    </div>
  );
}
