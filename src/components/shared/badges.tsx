import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/format";

const base = "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

// Colour + text label (never colour alone) for accessibility.
const TASK_STATUS_STYLES: Record<string, string> = {
  TODO: "border-slate-200 bg-slate-50 text-slate-700",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  BLOCKED: "border-amber-200 bg-amber-50 text-amber-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-zinc-200 bg-zinc-100 text-zinc-500 line-through decoration-zinc-400/60",
};
const PROJECT_STATUS_STYLES: Record<string, string> = {
  PLANNING: "border-violet-200 bg-violet-50 text-violet-700",
  ACTIVE: "border-blue-200 bg-blue-50 text-blue-700",
  ON_HOLD: "border-amber-200 bg-amber-50 text-amber-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-zinc-200 bg-zinc-100 text-zinc-500",
};
const DOT: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  BLOCKED: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-zinc-400",
  PLANNING: "bg-violet-500",
  ACTIVE: "bg-blue-500",
  ON_HOLD: "bg-amber-500",
};
const PRIORITY_STYLES: Record<string, string> = {
  LOW: "border-slate-200 bg-white text-slate-600",
  MEDIUM: "border-sky-200 bg-sky-50 text-sky-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge({ status, kind = "task", className }: { status: string; kind?: "task" | "project"; className?: string }) {
  const styles = kind === "task" ? TASK_STATUS_STYLES : PROJECT_STATUS_STYLES;
  const labels = kind === "task" ? TASK_STATUS_LABELS : PROJECT_STATUS_LABELS;
  return (
    <span className={cn(base, styles[status], className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[status])} />
      {labels[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return <span className={cn(base, PRIORITY_STYLES[priority], className)}>{PRIORITY_LABELS[priority] ?? priority}</span>;
}

export function RecordStatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span className={cn(base, active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-100 text-zinc-500")}>
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-zinc-400")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div className={cn("h-full rounded-full", v === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{v}%</span>
    </div>
  );
}
