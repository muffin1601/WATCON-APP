import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemberStatusConfirm, ResetAccessButton, ResetPasswordButton } from "@/components/members/member-actions";
import { TaskQuickFilters } from "@/components/members/task-quick-filters";
import { ReportActions } from "@/components/reports/report-actions";
import { RecordStatusBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { TaskTable } from "@/components/tasks/task-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { orNotFound } from "@/lib/pages";
import { can } from "@/lib/permissions/definitions";
import { getMember } from "@/modules/members/service";
import { toTaskRow } from "@/modules/tasks/serialize";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Team member" };

export default async function MemberProfilePage({ params, searchParams }: PageProps<"/team-members/[memberId]">) {
  const { memberId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { member, counts, projects, capabilities } = await orNotFound(getMember(user, memberId));
  const tasks = await listTasks(user, { ...sp, assigneeId: member.id });
  const canViewDirectory = can(user, "members.view");

  const info: [string, string][] = [
    ["Employee ID", member.employeeCode],
    ["Email", member.email],
    ["Username", member.username],
    ["Phone", member.phone ?? "—"],
    ["WhatsApp", member.whatsappNumber ?? "—"],
    ["Joining date", formatDate(member.joiningDate)],
    ["Role", member.role.name],
    ["Last sign-in", member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"],
  ];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials(member.fullName)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              {member.fullName}
              {member.designation && <span className="block text-sm font-normal text-muted-foreground">{member.designation}</span>}
            </span>
          </span>
        }
        breadcrumbs={canViewDirectory ? [{ label: "Team Members", href: "/team-members" }, { label: member.employeeCode }] : [{ label: "Dashboard", href: "/dashboard" }, { label: "My profile" }]}
        meta={
          <>
            <RecordStatusBadge status={member.status} />
            {capabilities.isSelf && <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">This is you</span>}
          </>
        }
        actions={
          <>
            {capabilities.canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/team-members/${member.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {capabilities.canResetAccess && member.status === "ACTIVE" && <ResetPasswordButton id={member.id} name={member.fullName} />}
            {capabilities.canResetAccess && member.status === "ACTIVE" && <ResetAccessButton id={member.id} name={member.fullName} />}
            {capabilities.canChangeStatus && <MemberStatusConfirm id={member.id} name={member.fullName} status={member.status} />}
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 lg:col-span-2" aria-labelledby="personal-info">
          <h2 id="personal-info" className="mb-4 text-sm font-semibold">
            Personal information
          </h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {info.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-xl border bg-card p-5" aria-labelledby="memberships">
          <h2 id="memberships" className="mb-3 text-sm font-semibold">
            Departments
          </h2>
          {member.departmentMembership.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not assigned to any department.</p>
          ) : (
            <ul className="space-y-2">
              {member.departmentMembership.map((m) => (
                <li key={m.department.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/departments/${m.department.id}`} className="truncate hover:text-primary hover:underline">
                    {m.department.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {m.department.id === member.primaryDepartmentId && <span className="rounded bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">Primary</span>}
                    {m.department.status !== "ACTIVE" && <RecordStatusBadge status={m.department.status} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt-5 mb-3 border-t pt-4 text-sm font-semibold">Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visible projects.</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/projects/${p.id}`} className="truncate hover:text-primary hover:underline">
                    {p.name}
                  </Link>
                  <StatusBadge kind="project" status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assigned tasks" value={counts.total} />
        <StatCard label="Pending" value={counts.pending} tone="info" />
        <StatCard label="Completed" value={counts.completed} tone="success" />
        <StatCard label="Overdue" value={counts.overdue} tone="danger" />
      </div>

      <section aria-labelledby="member-tasks">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="member-tasks" className="text-base font-semibold">
            Assigned tasks
          </h2>
          {capabilities.canReport && <ReportActions params={{ type: "member", id: member.id }} />}
        </div>
        <FilterBar params={["q", "status", "overdue", "priority"]}>
          <TaskQuickFilters counts={{ all: counts.total, pending: counts.pending, completed: counts.completed, overdue: counts.overdue }} />
          <SearchInput placeholder="Search tasks…" />
          <FilterSelect
            param="priority"
            label="Priority"
            options={[
              { value: "CRITICAL", label: "Critical" },
              { value: "HIGH", label: "High" },
              { value: "MEDIUM", label: "Medium" },
              { value: "LOW", label: "Low" },
            ]}
          />
        </FilterBar>
        <TaskTable rows={tasks.rows.map((r) => toTaskRow(r))} hide={["assignees", "startDate"]} />
        <Pagination total={tasks.total} page={tasks.page} pageSize={tasks.pageSize} />
      </section>
    </>
  );
}
