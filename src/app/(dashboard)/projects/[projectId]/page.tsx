import { CalendarDays, MapPin, Pencil, Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { StatusUpdateForm } from "@/components/projects/status-update-form";
import { ReportActions } from "@/components/reports/report-actions";
import { PriorityBadge, ProgressBar, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { UrlTabs } from "@/components/shared/url-tabs";
import { FilterBar, FilterSelect, SearchInput } from "@/components/tables/filters";
import { Pagination } from "@/components/tables/pagination";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, TASK_STATUS_LABELS } from "@/lib/format";
import { orNotFound } from "@/lib/pages";
import { listDepartmentOptions } from "@/modules/departments/service";
import { getProject, listStatusUpdates, projectActivity } from "@/modules/projects/service";
import { toTaskRow } from "@/modules/tasks/serialize";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Project" };

const TABS = ["overview", "tasks", "history", "activity"] as const;

export default async function ProjectDetailPage({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { project, counts, capabilities } = await orNotFound(getProject(user, projectId));
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (String(sp.tab) as (typeof TABS)[number]) : "overview";
  const latest = project.statusUpdates[0];

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.code }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{project.code}</span>
            <StatusBadge kind="project" status={project.status} />
            <PriorityBadge priority={project.priority} />
            {project.archivedAt && <span className="rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">Archived {formatDate(project.archivedAt)}</span>}
          </>
        }
        actions={
          <>
            {capabilities.canCreateTask && (
              <Button asChild size="sm">
                <Link href={`/tasks/new?projectId=${project.id}`}>
                  <Plus /> Create task
                </Link>
              </Button>
            )}
            {capabilities.canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/projects/${project.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {capabilities.canArchive && <ProjectArchiveButton projectId={project.id} name={project.name} archived={project.archivedAt !== null} />}
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <p className="text-sm whitespace-pre-line text-foreground/90">{project.description}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Site address</dt>
                <dd className="whitespace-pre-line">{project.siteAddress}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Project manager</dt>
                <dd>{project.manager ? project.manager.fullName : "—"}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Start date</dt>
                <dd>{formatDate(project.startDate)}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">Target completion</dt>
                <dd>{formatDate(project.expectedCompletionDate)}</dd>
              </div>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Task progress</h2>
          <ProgressBar value={counts.progress} className="mt-3" />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Total", counts.total],
              ["Open", counts.open],
              ["Done", counts.completed],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-muted/50 py-2">
                <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                <dt className="text-xs text-muted-foreground">{l}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Cancelled tasks are excluded from the completion rate.</p>
          {capabilities.canReport && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Project task list</p>
              <ReportActions params={{ type: "project", id: project.id }} />
            </div>
          )}
        </div>
      </div>

      <UrlTabs
        current={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "tasks", label: "Tasks", count: counts.total },
          { key: "history", label: "Status History" },
          { key: "activity", label: "Activity" },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5" aria-labelledby="current-status">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="current-status" className="text-sm font-semibold">
                Current project status
              </h2>
              {latest && (
                <span className="text-xs text-muted-foreground">
                  {latest.author.fullName} · {formatDateTime(latest.createdAt)}
                </span>
              )}
            </div>
            {latest ? <p className="text-sm leading-relaxed whitespace-pre-line">{latest.body}</p> : <p className="text-sm text-muted-foreground">No status has been posted yet.</p>}
            {capabilities.canPostStatus && (
              <div className="mt-4 border-t pt-4">
                <StatusUpdateForm projectId={project.id} />
              </div>
            )}
          </section>
          <ProjectTasks projectId={project.id} userId={user} sp={{ ...sp, pageSize: sp.pageSize ?? "10" }} compact canCreate={capabilities.canCreateTask} />
        </div>
      )}
      {tab === "tasks" && <ProjectTasks projectId={project.id} userId={user} sp={sp} canCreate={capabilities.canCreateTask} />}
      {tab === "history" && <StatusHistory userId={user} projectId={project.id} page={Number(sp.page) || 1} />}
      {tab === "activity" && <Activity userId={user} projectId={project.id} />}
    </>
  );
}

type Actor = Awaited<ReturnType<typeof requireUser>>;

async function ProjectTasks({ projectId, userId: actor, sp, compact, canCreate }: { projectId: string; userId: Actor; sp: Record<string, string | string[] | undefined>; compact?: boolean; canCreate: boolean }) {
  const [result, departments] = await Promise.all([listTasks(actor, { ...sp, projectId }), compact ? Promise.resolve([]) : listDepartmentOptions(actor)]);
  return (
    <section aria-label="Project tasks">
      {compact ? (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Project tasks</h2>
          <Link href={`/projects/${projectId}?tab=tasks`} className="text-sm text-primary hover:underline">
            View all with filters
          </Link>
        </div>
      ) : (
        <FilterBar params={["q", "status", "departmentId", "priority"]}>
          <SearchInput placeholder="Search tasks…" />
          <FilterSelect param="status" label="Status" options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <FilterSelect param="departmentId" label="Department" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        </FilterBar>
      )}
      <TaskTable
        rows={result.rows.map((r) => toTaskRow(r))}
        hide={["project", "startDate"]}
        empty={
          <EmptyState
            title="No tasks yet"
            description="Tasks created for this project appear here."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href={`/tasks/new?projectId=${projectId}`}>
                    <Plus /> Create task
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </section>
  );
}

async function StatusHistory({ userId: actor, projectId, page }: { userId: Actor; projectId: string; page: number }) {
  const history = await listStatusUpdates(actor, projectId, page);
  if (!history.total) return <EmptyState title="No status history" description="Status updates posted on the Overview tab are kept here permanently." />;
  return (
    <section aria-label="Status history">
      <ol className="relative space-y-4 border-l pl-6">
        {history.rows.map((u, i) => (
          <li key={u.id} className="relative">
            <span className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-card ${i === 0 && page === 1 ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden />
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{u.author.fullName}</span>
                <span>{formatDateTime(u.createdAt)}</span>
                {i === 0 && page === 1 && <span className="rounded bg-primary/10 px-1.5 py-px font-medium text-primary">Current</span>}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{u.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Pagination total={history.total} page={history.page} pageSize={history.pageSize} />
    </section>
  );
}

async function Activity({ userId: actor, projectId }: { userId: Actor; projectId: string }) {
  const items = await projectActivity(actor, projectId);
  if (!items.length) return <EmptyState title="No activity yet" />;
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-label="Project activity">
      {items.map((a) => (
        <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3">
          <span className="w-44 shrink-0 text-xs text-muted-foreground">{formatDateTime(a.at)}</span>
          <span className="font-medium">{a.actor}</span>
          {a.href ? (
            <Link href={a.href} className="text-muted-foreground hover:text-foreground hover:underline">
              {a.text}
            </Link>
          ) : (
            <span className="text-muted-foreground">{a.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
