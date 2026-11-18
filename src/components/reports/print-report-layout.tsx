import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate, formatDateTime } from "@/lib/format";
import type { ReportData } from "@/modules/reports/service";

/**
 * A4 print layout. Rows never split across pages (break-inside: avoid) and the
 * table header repeats on every printed page (thead as table-header-group).
 */
export function PrintReportLayout({ report }: { report: ReportData }) {
  const { tasks } = report;
  const open = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED").length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  return (
    <article className="mx-auto max-w-[210mm] bg-white p-6 text-[11px] leading-snug text-black print:max-w-none print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          {report.organization.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL logo
            <img src={report.organization.logoDataUrl} alt="" className="h-12 w-auto max-w-40 object-contain" />
          )}
          <div>
            <div className="text-base font-bold">{report.organization.name}</div>
            {report.organization.address && <div className="max-w-80 whitespace-pre-line text-[10px] text-neutral-600">{report.organization.address}</div>}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold">{report.title}</h1>
          <div className="text-[10px] text-neutral-600">Generated {formatDateTime(report.generatedAt)}</div>
          <div className="text-[10px] text-neutral-600">by {report.generatedBy}</div>
        </div>
      </header>

      <section className="print-avoid-break mt-3 grid grid-cols-[1fr_auto] gap-4">
        <div>
          <div className="text-sm font-semibold">{report.subject}</div>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {report.details.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-neutral-600">{d.label}</dt>
                <dd className="whitespace-pre-line">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex gap-3 text-center">
          {[["Tasks", tasks.length], ["Open", open], ["Completed", done]].map(([l, v]) => (
            <div key={l} className="rounded border border-neutral-300 px-3 py-1">
              <div className="text-base font-bold">{v}</div>
              <div className="text-[10px] text-neutral-600">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <table className="print-table mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 text-left">
            {["Code", "Task", "Assigned members", "Departments", "Priority", "Status", "Due", "Progress"].map((h) => (
              <th key={h} className="border border-neutral-300 px-1.5 py-1 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="align-top">
              <td className="border border-neutral-300 px-1.5 py-1 font-mono whitespace-nowrap">{t.code}</td>
              <td className="border border-neutral-300 px-1.5 py-1">
                <div className="font-semibold">{t.title}</div>
                {report.type !== "project" && <div className="text-[10px] text-neutral-600">{t.project.name}</div>}
                {t.description && <div className="mt-0.5 text-[10px] break-words whitespace-pre-line text-neutral-700">{t.description}</div>}
              </td>
              <td className="border border-neutral-300 px-1.5 py-1">{t.assignees.map((a) => a.user.fullName).join(", ") || "—"}</td>
              <td className="border border-neutral-300 px-1.5 py-1">{t.departments.map((d) => d.department.name).join(", ") || "—"}</td>
              <td className="border border-neutral-300 px-1.5 py-1 whitespace-nowrap">{PRIORITY_LABELS[t.priority]}</td>
              <td className="border border-neutral-300 px-1.5 py-1 whitespace-nowrap">{TASK_STATUS_LABELS[t.status]}</td>
              <td className="border border-neutral-300 px-1.5 py-1 whitespace-nowrap">{formatDate(t.dueDate)}</td>
              <td className="border border-neutral-300 px-1.5 py-1 text-right">{t.progress}%</td>
            </tr>
          ))}
          {!tasks.length && (
            <tr><td colSpan={8} className="border border-neutral-300 py-6 text-center text-neutral-500">No tasks.</td></tr>
          )}
        </tbody>
      </table>
      {report.truncated && <p className="mt-2 text-[10px] text-neutral-600">Only the first {tasks.length} tasks are included. Narrow the filters to print the rest.</p>}
    </article>
  );
}
