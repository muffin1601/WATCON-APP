import { AlertTriangle, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReportActions } from "@/components/reports/report-actions";
import { PriorityBadge, ProgressBar, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityList } from "@/components/tasks/activity-list";
import { CommentForm } from "@/components/tasks/comment-form";
import { ProgressDialog } from "@/components/tasks/progress-dialog";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/pages";
import { can } from "@/lib/permissions/definitions";
import { isOverdue, type TaskStatus } from "@/modules/tasks/rules";
import { getTask } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Task" };

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function TaskDetailPage({ params }: PageProps<"/tasks/[taskId]">) {
  const { taskId } = await params;
  const user = await requireUser();
  const { task, capabilities } = await orNotFound(getTask(user, taskId));
  const overdue = isOverdue({ dueDate: task.dueDate, status: task.status as TaskStatus });
  const canReport = can(user, "reports.view") || can(user, "reports.own");
  const canViewMembers = can(user, "members.view");
  const showProgress = capabilities.canUpdateProgress && (capabilities.canCancel || task.status !== "CANCELLED");

  return (
    <>
      <PageHeader
        title={task.title}
        breadcrumbs={[{ label: "Tasks", href: "/tasks" }, { label: task.code }]}
        meta={
          <>
            <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle className="size-3" aria-hidden /> Overdue
              </span>
            )}
          </>
        }
        actions={
          <>
            {showProgress && <ProgressDialog taskId={task.id} version={task.version} status={task.status} progress={task.progress} canCancel={capabilities.canCancel} />}
            {capabilities.canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/tasks/${task.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {canReport && <ReportActions params={{ type: "task", id: task.id }} compact />}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border bg-card p-5" aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="mb-2 text-sm font-semibold">
              Description
            </h2>
            {task.description ? <p className="text-sm leading-relaxed whitespace-pre-line">{task.description}</p> : <p className="text-sm text-muted-foreground">No description.</p>}
          </section>

          <section className="rounded-xl border bg-card p-5" aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="mb-3 text-sm font-semibold">
              Comments <span className="font-normal text-muted-foreground">({task.comments.length})</span>
            </h2>
            {task.comments.length ? (
              <ul className="mb-4 space-y-3">
                {task.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-muted/50 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{c.author.fullName}</span>
                      <span>{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">No comments yet.</p>
            )}
            {capabilities.canComment && <CommentForm taskId={task.id} />}
          </section>

          <section className="rounded-xl border bg-card p-5" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="mb-3 text-sm font-semibold">
              Activity
            </h2>
            <ActivityList
              items={task.activity.map((a) => ({ id: a.id, action: a.action, actor: a.actor.fullName, createdAt: a.createdAt.toISOString(), fromValue: a.fromValue, toValue: a.toValue }))}
            />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-card p-5" aria-label="Task details">
            <h2 className="mb-2 text-sm font-semibold">Progress</h2>
            <ProgressBar value={task.progress} />
            <dl className="mt-5 grid gap-4">
              <Item label="Project">
                <Link href={`/projects/${task.project.id}`} className="font-medium hover:text-primary hover:underline">
                  {task.project.name}
                </Link>{" "}
                <span className="font-mono text-xs text-muted-foreground">{task.project.code}</span>
              </Item>
              <Item label="Departments">
                {task.departments.length ? (
                  <span className="flex flex-wrap gap-1">
                    {task.departments.map((d) => (
                      <Link key={d.departmentId} href={`/departments/${d.department.id}`} className="rounded bg-muted px-1.5 py-px text-xs hover:bg-accent">
                        {d.department.name}
                        {d.department.status === "INACTIVE" && " (inactive)"}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Item>
              <Item label="Team members">
                {task.assignees.length ? (
                  <ul className="space-y-1">
                    {task.assignees.map((a) => (
                      <li key={a.userId} className="flex flex-wrap items-center gap-1.5">
                        {canViewMembers || a.userId === user.id ? (
                          <Link href={`/team-members/${a.user.id}`} className="hover:text-primary hover:underline">
                            {a.user.fullName}
                          </Link>
                        ) : (
                          <span>{a.user.fullName}</span>
                        )}
                        {a.userId === task.ownerId && <span className="rounded bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">Accountable</span>}
                        {a.user.status === "INACTIVE" && <span className="text-xs text-muted-foreground">(inactive)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </Item>
              <div className="grid grid-cols-2 gap-4">
                <Item label="Start date">{formatDate(task.startDate)}</Item>
                <Item label="Due date">
                  <span className={overdue ? "font-medium text-red-600" : undefined}>{formatDate(task.dueDate)}</span>
                </Item>
              </div>
              {task.completedAt && <Item label="Completed">{formatDateTime(task.completedAt)}</Item>}
              <Item label="Created by">
                {task.createdBy.fullName} <span className="text-xs text-muted-foreground">· {formatDateTime(task.createdAt)}</span>
              </Item>
              <Item label="Last updated">{formatDateTime(task.updatedAt)}</Item>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
