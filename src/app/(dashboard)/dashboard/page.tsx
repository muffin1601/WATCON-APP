import { AlertTriangle, Building2, CheckCircle2, CircleDashed, FolderKanban, FolderOpen, ListChecks, Loader, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PriorityBadge, ProgressBar, StatusBadge } from "@/components/shared/badges";
import { MyWork } from "@/components/insights/my-work";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { getDashboard } from "@/modules/dashboard/service";
import type { TaskListRow } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Dashboard" };

const ACTION_TEXT: Record<string, string> = {
  CREATED: "created",
  EDITED: "edited",
  ASSIGNEES_CHANGED: "changed the assignees of",
  DEPARTMENTS_CHANGED: "changed the departments of",
  OWNER_CHANGED: "changed the owner of",
  STATUS_CHANGED: "changed the status of",
  PROGRESS_CHANGED: "updated progress on",
  DUE_DATE_CHANGED: "changed the due date of",
  COMMENT_ADDED: "commented on",
  COMPLETED: "completed",
  REOPENED: "reopened",
};

function TaskList({ tasks, empty }: { tasks: TaskListRow[]; empty: string }) {
  if (!tasks.length) return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/tasks/${t.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
              {t.title}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              {t.code} · {t.project.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
            <span className="w-24 text-right text-xs whitespace-nowrap text-muted-foreground">Due {formatDate(t.dueDate)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={title}>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const d = await getDashboard(user);
  const m = d.metrics;
  const denied = (await searchParams).denied === "1";
  const qa = d.quickActions;
  const anyQuick = qa.createProject || qa.createTask || qa.addDepartment || qa.addMember;

  return (
    <>
      <PageHeader title={`Welcome, ${user.fullName.split(" ")[0]}`} description="Live overview of the projects and tasks you can access." />
      {denied && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">You do not have permission to open that page.</p>}
      <MyWork user={user} />

      {anyQuick && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Quick actions">
          {qa.createProject && (
            <Button asChild size="sm">
              <Link href="/projects/new"><Plus /> Create project</Link>
            </Button>
          )}
          {qa.createTask && (
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks/new"><Plus /> Create task</Link>
            </Button>
          )}
          {qa.addDepartment && (
            <Button asChild size="sm" variant="outline">
              <Link href="/departments?new=1"><Plus /> Add department</Link>
            </Button>
          )}
          {qa.addMember && (
            <Button asChild size="sm" variant="outline">
              <Link href="/team-members/new"><Plus /> Add team member</Link>
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total projects" value={m.totalProjects} icon={FolderKanban} href="/projects" />
        <StatCard label="Active projects" value={m.activeProjects} icon={FolderOpen} tone="info" href="/projects?status=ACTIVE" />
        <StatCard label="Completed projects" value={m.completedProjects} icon={CheckCircle2} tone="success" href="/projects?status=COMPLETED" />
        <StatCard label="Total tasks" value={m.totalTasks} icon={ListChecks} href="/tasks" />
        <StatCard label="Pending tasks" value={m.pendingTasks} icon={CircleDashed} href="/tasks?status=TODO,BLOCKED" hint="To Do + Blocked" />
        <StatCard label="In progress" value={m.inProgressTasks} icon={Loader} tone="info" href="/tasks?status=IN_PROGRESS" />
        <StatCard label="Completed tasks" value={m.completedTasks} icon={CheckCircle2} tone="success" href="/tasks?status=COMPLETED" />
        <StatCard label="Overdue tasks" value={m.overdueTasks} icon={AlertTriangle} tone="danger" href="/tasks?overdue=1" />
        <StatCard label="Departments" value={m.totalDepartments} icon={Building2} href="/departments" />
        {m.totalMembers !== null && <StatCard label="Team members" value={m.totalMembers} icon={Users} href="/team-members" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="My tasks" action={<Link href="/tasks?mine=1" className="text-xs text-primary hover:underline">View all</Link>}>
          <TaskList tasks={d.myTasks} empty="No open tasks are assigned to you." />
        </Panel>
        <Panel title="Overdue tasks" action={<Link href="/tasks?overdue=1" className="text-xs text-primary hover:underline">View all</Link>}>
          <TaskList tasks={d.overdueTasks} empty="Nothing is overdue." />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Panel title="Recent projects" action={<Link href="/projects" className="text-xs text-primary hover:underline">All projects</Link>}>
            {d.recentProjects.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium">Project</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Tasks</th>
                      <th className="px-3 py-2 text-right font-medium">Done</th>
                      <th className="min-w-32 px-3 py-2 text-left font-medium">Progress</th>
                      <th className="px-5 py-2 text-right font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.recentProjects.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-2.5">
                          <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
                          <div className="max-w-64 truncate text-xs text-muted-foreground">{p.siteAddress}</div>
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge kind="project" status={p.status} /></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{p.counts.total}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{p.counts.completed}</td>
                        <td className="px-3 py-2.5"><ProgressBar value={p.counts.progress} /></td>
                        <td className="px-5 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5"><EmptyState icon={FolderKanban} title="No projects yet" /></div>
            )}
          </Panel>
        </div>
        <Panel title="Recent activity">
          {d.activity.length ? (
            <ul className="divide-y">
              {d.activity.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <p>
                    <span className="font-medium">{a.actor.fullName}</span> {ACTION_TEXT[a.action] ?? a.action.toLowerCase()}{" "}
                    <Link href={`/tasks/${a.task.id}`} className="font-medium hover:text-primary hover:underline">{a.task.code}</Link>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.task.title} · {a.task.project.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No recent activity.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
