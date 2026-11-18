import { formatDate, formatDateTime, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/format";

export type ActivityItem = { id: string; action: string; actor: string; createdAt: string; fromValue: unknown; toValue: unknown };

const FIELD_LABELS: Record<string, string> = { title: "title", description: "description", priority: "priority", startDate: "start date", projectId: "project" };

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(show).join(", ") : "none";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(`${value}T00:00:00.000Z`);
    return TASK_STATUS_LABELS[value] ?? PRIORITY_LABELS[value] ?? value;
  }
  return "—";
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function describe(item: ActivityItem): string {
  const { action, fromValue: from, toValue: to } = item;
  switch (action) {
    case "CREATED":
      return "created the task";
    case "STATUS_CHANGED":
      return `changed status from ${show(from)} to ${show(to)}`;
    case "PROGRESS_CHANGED":
      return `changed progress from ${show(from)}% to ${show(to)}%`;
    case "COMPLETED":
      return "completed the task";
    case "REOPENED":
      return `reopened the task (${show(from)} → ${show(to)})`;
    case "DUE_DATE_CHANGED":
      return `changed the due date from ${show(from)} to ${show(to)}`;
    case "ASSIGNEES_CHANGED":
      return `changed team members from ${show(from)} to ${show(to)}`;
    case "DEPARTMENTS_CHANGED":
      return `changed departments from ${show(from)} to ${show(to)}`;
    case "OWNER_CHANGED":
      return `changed the accountable owner from ${show(from)} to ${show(to)}`;
    case "COMMENT_ADDED":
      return "added a comment";
    case "EDITED": {
      const toRec = isRecord(to) ? to : {};
      const fromRec = isRecord(from) ? from : {};
      const fields = Object.keys(toRec);
      if (!fields.length) return "edited the task";
      const parts = fields.map((f) => {
        const label = FIELD_LABELS[f] ?? f;
        if (f === "description" || f === "projectId") return label;
        return `${label} (${show(fromRec[f])} → ${show(toRec[f])})`;
      });
      return `edited ${parts.join(", ")}`;
    }
    default:
      return action.replaceAll("_", " ").toLowerCase();
  }
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative space-y-3 border-l pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative text-sm">
          <span className="absolute top-1.5 -left-[24.5px] size-2 rounded-full bg-muted-foreground/40" aria-hidden />
          <span className="font-medium">{a.actor}</span> <span className="text-muted-foreground">{describe(a)}</span>
          <div className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</div>
        </li>
      ))}
    </ol>
  );
}
