"use client";

import { Eye, MoreHorizontal, Pencil, Power, PowerOff, Users } from "lucide-react";
import Link from "next/link";
import { RecordStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberStatusConfirm } from "./member-actions";

export type MemberRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string | null;
  email: string;
  phone: string | null;
  status: string;
  role: string;
  roleKey: string;
  primaryDepartment: string | null;
  otherDepartments: number;
  activeTasks: number;
  completedTasks: number;
  canManage: boolean;
  isSelf: boolean;
};

function RowActions({ row }: { row: MemberRow }) {
  const active = row.status === "ACTIVE";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.fullName}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/team-members/${row.id}`}>
            <Eye /> View profile
          </Link>
        </DropdownMenuItem>
        {row.canManage && (
          <DropdownMenuItem asChild>
            <Link href={`/team-members/${row.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </DropdownMenuItem>
        )}
        {row.canManage && !row.isSelf && (
          <>
            <DropdownMenuSeparator />
            <MemberStatusConfirm
              id={row.id}
              name={row.fullName}
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
  );
}

export function MembersTable({ rows, canCreate }: { rows: MemberRow[]; canCreate: boolean }) {
  const columns: DataTableColumn<MemberRow>[] = [
    { id: "employeeCode", header: "Employee ID", sortKey: "employeeCode", cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{row.original.employeeCode}</span> },
    {
      id: "fullName",
      header: "Name",
      sortKey: "fullName",
      cell: ({ row }) => (
        <Link href={`/team-members/${row.original.id}`} className="font-medium whitespace-nowrap hover:text-primary hover:underline">
          {row.original.fullName}
        </Link>
      ),
    },
    { id: "designation", header: "Designation", cell: ({ row }) => <span className="text-muted-foreground">{row.original.designation ?? "—"}</span> },
    {
      id: "department",
      header: "Department",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.primaryDepartment ?? "—"}
          {row.original.otherDepartments > 0 && <span className="ml-1 text-xs text-muted-foreground">+{row.original.otherDepartments}</span>}
        </span>
      ),
    },
    { id: "email", header: "Email", cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
    { id: "phone", header: "Phone", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{row.original.phone ?? "—"}</span> },
    { id: "active", header: "Active tasks", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.activeTasks}</span> },
    { id: "completed", header: "Completed", className: "text-right", cell: ({ row }) => <span className="tabular-nums">{row.original.completedTasks}</span> },
    { id: "role", header: "Role", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.role}</span> },
    { id: "status", header: "Account", cell: ({ row }) => <RecordStatusBadge status={row.original.status} /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, className: "w-10", cell: ({ row }) => <RowActions row={row.original} /> },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      defaultSort="fullName"
      empty={
        <EmptyState
          icon={Users}
          title="No team members found"
          description="Try adjusting your search or filters."
          action={
            canCreate ? (
              <Button asChild>
                <Link href="/team-members/new">Add member</Link>
              </Button>
            ) : undefined
          }
        />
      }
    />
  );
}
