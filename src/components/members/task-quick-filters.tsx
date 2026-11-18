"use client";

import { useQueryParams } from "@/hooks/use-query-params";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All", status: null, overdue: null },
  { key: "pending", label: "Pending", status: "TODO,IN_PROGRESS,BLOCKED", overdue: null },
  { key: "completed", label: "Completed", status: "COMPLETED", overdue: null },
  { key: "overdue", label: "Overdue", status: null, overdue: "1" },
] as const;

/** All / Pending / Completed / Overdue segmented control bound to `status` + `overdue` URL params. */
export function TaskQuickFilters({ counts }: { counts?: Partial<Record<"all" | "pending" | "completed" | "overdue", number>> }) {
  const { get, setParams } = useQueryParams();
  const status = get("status");
  const overdue = get("overdue");
  const current = FILTERS.find((f) => (f.status ?? "") === status && (f.overdue ?? "") === overdue)?.key ?? (status || overdue ? null : "all");
  return (
    <div role="group" aria-label="Task status" className="inline-flex flex-wrap rounded-lg border bg-card p-0.5">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={current === f.key}
          onClick={() => setParams({ status: f.status, overdue: f.overdue })}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", current === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
        >
          {f.label}
          {counts?.[f.key] !== undefined && <span className="tabular-nums text-xs opacity-70">{counts[f.key]}</span>}
        </button>
      ))}
    </div>
  );
}
