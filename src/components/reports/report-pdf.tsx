import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate, formatDateTime } from "@/lib/format";
import type { ReportData } from "@/modules/reports/service";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 32, fontSize: 8.5, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: "#111", paddingBottom: 8, marginBottom: 10 },
  org: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555", fontSize: 7.5 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  subject: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#bbb", paddingVertical: 4 },
  head: { flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 0.75, borderColor: "#999", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", color: "#777", fontSize: 7 },
});

const COLS = [
  { key: "code", label: "Code", w: "10%" },
  { key: "task", label: "Task", w: "30%" },
  { key: "members", label: "Assigned members", w: "16%" },
  { key: "depts", label: "Departments", w: "13%" },
  { key: "priority", label: "Priority", w: "8%" },
  { key: "status", label: "Status", w: "9%" },
  { key: "due", label: "Due", w: "8%" },
  { key: "progress", label: "Progress", w: "6%" },
] as const;

/** A4 PDF. Each task row is `wrap={false}` so it is never split across pages; the header row repeats (`fixed`). */
export function ReportPdf({ report }: { report: ReportData }) {
  return (
    <Document title={`${report.title} — ${report.subject}`} author={report.organization.name}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header} fixed>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {report.organization.logoDataUrl && <Image src={report.organization.logoDataUrl} style={{ height: 32, maxWidth: 110, objectFit: "contain" }} />}
            <View>
              <Text style={s.org}>{report.organization.name}</Text>
              {report.organization.address && <Text style={s.muted}>{report.organization.address}</Text>}
            </View>
          </View>
          <View>
            <Text style={s.title}>{report.title}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Generated {formatDateTime(report.generatedAt)} by {report.generatedBy}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 8 }} wrap={false}>
          <Text style={s.subject}>{report.subject}</Text>
          {report.details.map((d) => (
            <Text key={d.label}>
              <Text style={{ color: "#555" }}>{d.label}: </Text>
              {d.value}
            </Text>
          ))}
          <Text style={[s.muted, { marginTop: 3 }]}>
            Tasks: {report.tasks.length} · Open: {report.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED").length} · Completed: {report.tasks.filter((t) => t.status === "COMPLETED").length}
          </Text>
        </View>

        <View style={s.head} fixed>
          {COLS.map((c) => (
            <Text key={c.key} style={{ width: c.w, paddingHorizontal: 3 }}>{c.label}</Text>
          ))}
        </View>
        {report.tasks.map((t) => (
          <View key={t.id} style={s.row} wrap={false}>
            <Text style={{ width: COLS[0].w, paddingHorizontal: 3, fontFamily: "Courier" }}>{t.code}</Text>
            <View style={{ width: COLS[1].w, paddingHorizontal: 3 }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{t.title}</Text>
              {report.type !== "project" && <Text style={s.muted}>{t.project.name}</Text>}
              {t.description && <Text style={[s.muted, { marginTop: 1 }]}>{t.description.length > 1200 ? `${t.description.slice(0, 1200)}…` : t.description}</Text>}
            </View>
            <Text style={{ width: COLS[2].w, paddingHorizontal: 3 }}>{t.assignees.map((a) => a.user.fullName).join(", ") || "—"}</Text>
            <Text style={{ width: COLS[3].w, paddingHorizontal: 3 }}>{t.departments.map((d) => d.department.name).join(", ") || "—"}</Text>
            <Text style={{ width: COLS[4].w, paddingHorizontal: 3 }}>{PRIORITY_LABELS[t.priority]}</Text>
            <Text style={{ width: COLS[5].w, paddingHorizontal: 3 }}>{TASK_STATUS_LABELS[t.status]}</Text>
            <Text style={{ width: COLS[6].w, paddingHorizontal: 3 }}>{formatDate(t.dueDate)}</Text>
            <Text style={{ width: COLS[7].w, paddingHorizontal: 3, textAlign: "right" }}>{t.progress}%</Text>
          </View>
        ))}
        {!report.tasks.length && <Text style={{ marginTop: 12, textAlign: "center", color: "#777" }}>No tasks.</Text>}
        {report.truncated && <Text style={[s.muted, { marginTop: 6 }]}>Only the first {report.tasks.length} tasks are included.</Text>}

        <View style={s.footer} fixed>
          <Text>{report.organization.name} · {report.title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
