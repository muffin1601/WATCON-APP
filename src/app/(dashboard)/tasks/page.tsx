import { Info, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReportActions } from "@/components/reports/report-actions";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { DueThisMonthToggle, FlagToggle } from "@/components/tasks/task-filter-toggles";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requireUser } from "@/lib/auth/session";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/format";
import { can } from "@/lib/permissions/definitions";
import { listDepartmentOptions } from "@/modules/departments/service";
import { listMemberOptions } from "@/modules/members/service";
import { listProjectOptions } from "@/modules/projects/service";
import { toTaskRow } from "@/modules/tasks/serialize";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Tasks" };

const FILTER_PARAMS = ["q", "projectId", "departmentId", "assigneeId", "status", "priority", "createdFrom", "createdTo", "dueFrom", "dueTo", "overdue", "assigned", "mine"];

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const sp = await searchParams;
  const [result, projects, departments, people] = await Promise.all([listTasks(user, sp), listProjectOptions(user), listDepartmentOptions(user), listMemberOptions(user)]);
  const canCreate = can(user, "tasks.create");

  // Report params mirror the active filters (the server re-validates and re-scopes them).
  const reportFilters: Record<string, string> = {};
  for (const key of FILTER_PARAMS) {
    const v = sp[key];
    const value = Array.isArray(v) ? v[0] : v;
    if (value) reportFilters[key] = value;
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description="The complete task register across all projects you can access."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tasks" }]}
        actions={
          <>
            {can(user, "reports.view") ? (
              <ReportActions params={{ type: "global", ...reportFilters }} />
            ) : can(user, "reports.own") ? (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className="text-xs text-muted-foreground">My task list</span>
                <ReportActions params={{ type: "member", id: user.id }} />
              </div>
            ) : null}
            {canCreate && (
              <Button asChild>
                <Link href="/tasks/new">
                  <Plus /> Create task
                </Link>
              </Button>
            )}
          </>
        }
      />
      <FilterBar params={FILTER_PARAMS}>
        <SearchInput placeholder="Search title, code or description…" />
        <FilterSelect param="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect param="departmentId" label="Department" options={departments.map((d) => ({ value: d.id, label: d.status === "INACTIVE" ? `${d.name} (inactive)` : d.name }))} />
        {people.length > 0 && <FilterSelect param="assigneeId" label="Team member" options={people.map((p) => ({ value: p.id, label: p.fullName }))} />}
        <FilterSelect param="status" label="Status" options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="priority" label="Priority" options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect
          param="assigned"
          label="Assignment"
          options={[
            { value: "assigned", label: "Assigned" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
        <DateRangeFilter fromParam="createdFrom" toParam="createdTo" label="Created" />
        <DateRangeFilter fromParam="dueFrom" toParam="dueTo" label="Due" />
        <DueThisMonthToggle />
        <FlagToggle param="overdue" label="Overdue" icon="overdue" />
        <FlagToggle param="mine" label="My tasks" icon="mine" />
      </FilterBar>
      <div className="mb-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Info className="size-3.5" aria-hidden /> How sorting works
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Sorting by Departments or Team members uses the alphabetically-first assigned department / member of each task. Tasks with no departments, members or due date always sort last. Ties are ordered by task code.
          </TooltipContent>
        </Tooltip>
      </div>
      <TaskTable rows={result.rows.map((r) => toTaskRow(r))} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
  );
}
