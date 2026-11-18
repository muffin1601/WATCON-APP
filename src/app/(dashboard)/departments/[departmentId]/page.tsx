import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EditDepartmentButton } from "@/components/departments/department-form";
import { DepartmentMembers } from "@/components/departments/department-members";
import { DepartmentStatusConfirm } from "@/components/departments/department-status-button";
import { TaskQuickFilters } from "@/components/members/task-quick-filters";
import { ReportActions } from "@/components/reports/report-actions";
import { RecordStatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { orNotFound } from "@/lib/pages";
import { can } from "@/lib/permissions/definitions";
import { getDepartment } from "@/modules/departments/service";
import { listMemberOptions } from "@/modules/members/service";
import { listProjectOptions } from "@/modules/projects/service";
import { toTaskRow } from "@/modules/tasks/serialize";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Department" };

export default async function DepartmentDetailPage({ params, searchParams }: PageProps<"/departments/[departmentId]">) {
  const { departmentId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { department, counts, capabilities } = await orNotFound(getDepartment(user, departmentId));
  const [tasks, people, projects] = await Promise.all([
    listTasks(user, { ...sp, departmentId: department.id }),
    capabilities.canManage ? listMemberOptions(user) : Promise.resolve([]),
    listProjectOptions(user),
  ]);
  const memberIds = new Set(department.members.map((m) => m.userId));
  const active = department.status === "ACTIVE";

  return (
    <>
      <PageHeader
        title={department.name}
        breadcrumbs={[{ label: "Departments", href: "/departments" }, { label: department.code }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{department.code}</span>
            <RecordStatusBadge status={department.status} />
          </>
        }
        actions={
          <>
            {can(user, "tasks.create") && active && (
              <Button asChild size="sm">
                <Link href="/tasks/new">
                  <Plus /> Create task
                </Link>
              </Button>
            )}
            {capabilities.canManage && (
              <>
                <EditDepartmentButton
                  people={people}
                  department={{ id: department.id, code: department.code, name: department.name, description: department.description, headId: department.headId, status: department.status }}
                />
                <DepartmentStatusConfirm id={department.id} name={department.name} status={department.status} />
              </>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border bg-card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Department head</dt>
                <dd className="mt-0.5 font-medium">{department.head ? department.head.fullName : "—"}</dd>
                {department.head?.designation && <dd className="text-xs text-muted-foreground">{department.head.designation}</dd>}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Members</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{department._count.members}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd className="mt-0.5">{formatDate(department.createdAt)}</dd>
              </div>
            </dl>
            {department.description && <p className="mt-4 border-t pt-4 text-sm whitespace-pre-line text-foreground/90">{department.description}</p>}
            {!active && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">This department is inactive. Its history is kept, but it cannot receive new members or tasks.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Assigned tasks" value={counts.total} />
            <StatCard label="Pending" value={counts.pending} tone="info" />
            <StatCard label="Completed" value={counts.completed} tone="success" />
            <StatCard label="Overdue" value={counts.overdue} tone="danger" />
          </div>
        </div>
        <DepartmentMembers
          departmentId={department.id}
          departmentName={department.name}
          active={active}
          canManage={capabilities.canManage}
          canViewProfiles={can(user, "members.view")}
          totalMembers={department._count.members}
          candidates={people.filter((p) => !memberIds.has(p.id))}
          members={department.members.map((m) => ({
            id: m.user.id,
            fullName: m.user.fullName,
            designation: m.user.designation,
            employeeCode: m.user.employeeCode,
            status: m.user.status,
            isPrimary: m.user.primaryDepartmentId === department.id,
            isHead: m.user.id === department.headId,
          }))}
        />
      </div>

      <section aria-labelledby="dept-tasks">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="dept-tasks" className="text-base font-semibold">
            Department tasks
          </h2>
          {capabilities.canReport && <ReportActions params={{ type: "department", id: department.id }} />}
        </div>
        <FilterBar params={["q", "projectId", "status", "overdue"]}>
          <TaskQuickFilters counts={{ all: counts.total, pending: counts.pending, completed: counts.completed, overdue: counts.overdue }} />
          <SearchInput placeholder="Search tasks…" />
          <FilterSelect param="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </FilterBar>
        <TaskTable rows={tasks.rows.map((r) => toTaskRow(r))} hide={["departments", "startDate"]} />
        <Pagination total={tasks.total} page={tasks.page} pageSize={tasks.pageSize} />
      </section>
    </>
  );
}
