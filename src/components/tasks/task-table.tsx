"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PriorityBadge, ProgressBar, StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskRowData } from "@/modules/tasks/serialize";

function Names({ items, max = 2 }: { items: { id: string; name: string }[]; max?: number }) {
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  const shown = items.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1" title={items.map((i) => i.name).join(", ")}>
      {shown.map((i) => (
        <span key={i.id} className="rounded bg-muted px-1.5 py-px text-xs whitespace-nowrap">
          {i.name}
        </span>
      ))}
      {items.length > max && <span className="text-xs text-muted-foreground">+{items.length - max}</span>}
    </span>
  );
}

type ColumnKey = "code" | "title" | "project" | "departments" | "assignees" | "priority" | "status" | "startDate" | "dueDate" | "progress";

/**
 * The one task table used by the global register and the project / department /
 * member pages. `sortable` enables server-side sort headers (URL `sort`/`dir`).
 */
export function TaskTable({ rows, hide = [], sortable = true, empty }: { rows: TaskRowData[]; hide?: ColumnKey[]; sortable?: boolean; empty?: ReactNode }) {
  const s = (key: string) => (sortable ? key : undefined);
  const all: (DataTableColumn<TaskRowData> & { key: ColumnKey })[] = [
    { key: "code", id: "code", header: "Code", sortKey: s("code"), cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{row.original.code}</span> },
    {
      key: "title",
      id: "title",
      header: "Task",
      sortKey: s("title"),
      className: "min-w-56",
      cell: ({ row }) => (
        <Link href={`/tasks/${row.original.id}`} className="font-medium hover:text-primary hover:underline">
          {row.original.title}
        </Link>
      ),
    },
    {
      key: "project",
      id: "project",
      header: "Project",
      sortKey: s("project"),
      cell: ({ row }) => (
        <Link href={`/projects/${row.original.project.id}`} className="whitespace-nowrap text-muted-foreground hover:text-foreground hover:underline">
          {row.original.project.name}
        </Link>
      ),
    },
    { key: "departments", id: "departments", header: "Departments", sortKey: s("department"), cell: ({ row }) => <Names items={row.original.departments} /> },
    { key: "assignees", id: "assignees", header: "Team members", sortKey: s("assignee"), cell: ({ row }) => <Names items={row.original.assignees.map((a) => ({ id: a.id, name: a.fullName }))} /> },
    { key: "priority", id: "priority", header: "Priority", sortKey: s("priority"), cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
    { key: "status", id: "status", header: "Status", sortKey: s("status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { key: "startDate", id: "startDate", header: "Start", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.startDate)}</span> },
    {
      key: "dueDate",
      id: "dueDate",
      header: "Due",
      sortKey: s("dueDate"),
      cell: ({ row }) => (
        <span className={cn("whitespace-nowrap", row.original.overdue ? "font-medium text-red-600" : "text-muted-foreground")}>
          {formatDate(row.original.dueDate)}
          {row.original.overdue && <span className="sr-only"> (overdue)</span>}
        </span>
      ),
    },
    { key: "progress", id: "progress", header: "Progress", className: "min-w-32", cell: ({ row }) => <ProgressBar value={row.original.progress} /> },
  ];
  const columns = all.filter((c) => !hide.includes(c.key));
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      defaultSort="dueDate"
      empty={empty ?? <EmptyState icon={ListChecks} title="No tasks found" description="No tasks match the current view." />}
    />
  );
}
