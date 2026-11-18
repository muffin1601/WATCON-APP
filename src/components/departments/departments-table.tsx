"use client";

import { Building2, Eye, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PersonOption } from "@/components/forms/combobox";
import { RecordStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditDepartmentDialog, type DepartmentDefaults } from "./department-form";
import { DepartmentStatusConfirm } from "./department-status-button";

export type DepartmentRow = DepartmentDefaults & {
  head: string | null;
  memberCount: number;
  taskCount: number;
  pendingCount: number;
  completedCount: number;
};

function RowActions({ row, canManage, people }: { row: DepartmentRow; canManage: boolean; people: PersonOption[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const active = row.status === "ACTIVE";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/departments/${row.id}`}>
              <Eye /> View details
            </Link>
          </DropdownMenuItem>
          {canManage && (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DepartmentStatusConfirm
                id={row.id}
                name={row.name}
                status={row.status}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    {active ? <PowerOff /> : <Power />} {active ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canManage && <EditDepartmentDialog people={people} department={row} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  );
}

export function DepartmentsTable({ rows, canManage, people }: { rows: DepartmentRow[]; canManage: boolean; people: PersonOption[] }) {
  const columns: DataTableColumn<DepartmentRow>[] = [
    {
      id: "name",
      header: "Department",
      sortKey: "name",
      cell: ({ row }) => (
        <Link href={`/departments/${row.original.id}`} className="font-medium hover:text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { id: "code", header: "Code", sortKey: "code", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span> },
    { id: "head", header: "Head", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.head ?? "—"}</span> },
    { id: "members", header: "Members", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.memberCount}</span> },
    { id: "tasks", header: "Tasks", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.taskCount}</span> },
    { id: "pending", header: "Pending", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.pendingCount}</span> },
    { id: "completed", header: "Completed", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.completedCount}</span> },
    { id: "status", header: "Status", cell: ({ row }) => <RecordStatusBadge status={row.original.status} /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, className: "w-10", cell: ({ row }) => <RowActions row={row.original} canManage={canManage} people={people} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      defaultSort="name"
      empty={<EmptyState icon={Building2} title="No departments found" description={canManage ? "Add a department or adjust your filters." : "Try adjusting your search or filters."} />}
    />
  );
}
