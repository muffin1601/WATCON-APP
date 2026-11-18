/**
 * WhatsApp click-to-chat helpers (official wa.me links only — no automation).
 * The link opens WhatsApp with a prefilled message; the sender reviews and sends it
 * themselves. Links cannot attach files, so full details go in the exported PDF.
 */

const MAX_MESSAGE_CHARS = 3000;

/** Normalises a phone number to wa.me digits. 10-digit local numbers get the default country code. */
export function normalizeWhatsAppNumber(raw: string | null | undefined, defaultCountryCode = "91"): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function whatsappLink(text: string, phone?: string | null): string {
  const number = normalizeWhatsAppNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}

export type SummaryTask = {
  code: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: Date | null;
  project?: { name: string } | null;
  assignees?: { user: { fullName: string } }[];
};

const STATUS_LABEL: Record<string, string> = { TODO: "To Do", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", COMPLETED: "Completed", CANCELLED: "Cancelled" };

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "—";
}

/** Readable, length-capped plain-text summary for a WhatsApp message. */
export function buildTaskSummary(opts: { heading: string; subheading?: string; tasks: SummaryTask[]; showProject?: boolean; showAssignees?: boolean; footer?: string }): string {
  const { tasks } = opts;
  const open = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED").length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const lines: string[] = [`*${opts.heading}*`];
  if (opts.subheading) lines.push(opts.subheading);
  lines.push(`Tasks: ${tasks.length} · Open: ${open} · Completed: ${done}`, "");
  let used = lines.join("\n").length;
  let shown = 0;
  for (const [i, t] of tasks.entries()) {
    const parts = [`${i + 1}. ${t.code} — ${t.title}`, `   ${STATUS_LABEL[t.status] ?? t.status} · ${t.progress}% · Due ${fmt(t.dueDate)} · ${t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}`];
    if (opts.showProject && t.project) parts.push(`   Project: ${t.project.name}`);
    if (opts.showAssignees && t.assignees?.length) parts.push(`   Team: ${t.assignees.map((a) => a.user.fullName).join(", ")}`);
    const block = parts.join("\n");
    if (used + block.length + 80 > MAX_MESSAGE_CHARS) break;
    lines.push(block);
    used += block.length + 1;
    shown++;
  }
  if (shown < tasks.length) lines.push("", `…and ${tasks.length - shown} more task(s). Full details are in the PDF report.`);
  if (opts.footer) lines.push("", opts.footer);
  return lines.join("\n");
}
