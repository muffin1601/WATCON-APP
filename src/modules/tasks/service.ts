import "server-only";
import { db, type Prisma, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextCode } from "@/lib/codes";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, zodFieldErrors } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions/definitions";
import { projectManageWhere, taskAccessWhere, taskManageWhere } from "@/lib/permissions/scopes";
import { fromDbDate, toDbDate } from "@/lib/validations/common";
import { TaskActivityAction } from "@/generated/prisma/enums";
import { applyTaskTransition, type TaskStatus } from "./rules";
import { buildTaskOrderBy, buildTaskWhere } from "./filters";
import { commentSchema, progressUpdateSchema, taskInputSchema, taskListQuerySchema, type TaskData } from "./validation";

export const taskListSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  progress: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  project: { select: { id: true, code: true, name: true } },
  owner: { select: { id: true, fullName: true } },
  departments: { select: { department: { select: { id: true, name: true } } }, orderBy: { department: { name: "asc" } } },
  assignees: { select: { user: { select: { id: true, fullName: true } } }, orderBy: { user: { fullName: "asc" } } },
} satisfies Prisma.TaskSelect;

export type TaskListRow = Prisma.TaskGetPayload<{ select: typeof taskListSelect }>;

export async function listTasks(actor: Actor, rawQuery: unknown) {
  const query = taskListQuerySchema.parse(rawQuery ?? {});
  const where = buildTaskWhere(actor, query);
  const [total, rows] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      orderBy: buildTaskOrderBy(query.sort, query.dir),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: taskListSelect,
    }),
  ]);
  return { rows, total, page: query.page, pageSize: query.pageSize, query };
}

/** Unpaginated (capped) list for reports. Uses the same scope + filters as the register. */
export async function listTasksForReport(actor: Actor, filter: Prisma.TaskWhereInput, limit = 2000) {
  return db.task.findMany({
    where: { AND: [taskAccessWhere(actor), filter] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { code: "asc" }],
    take: limit,
    select: taskListSelect,
  });
}

export async function getTask(actor: Actor, id: string) {
  const task = await db.task.findFirst({
    where: { AND: [taskAccessWhere(actor), { id }] },
    include: {
      project: { select: { id: true, code: true, name: true, archivedAt: true } },
      owner: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
      departments: { include: { department: { select: { id: true, name: true, status: true } } }, orderBy: { department: { name: "asc" } } },
      assignees: { include: { user: { select: { id: true, fullName: true, designation: true, whatsappNumber: true, status: true } } }, orderBy: { user: { fullName: "asc" } } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, fullName: true } } } },
      activity: { orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { id: true, fullName: true } } } },
    },
  });
  if (!task) throw new NotFoundError("Task");
  const manageable = can(actor, "tasks.manage") && (await db.task.count({ where: { AND: [taskManageWhere(actor), { id }] } })) > 0;
  const isAssignee = task.assignees.some((a) => a.userId === actor.id);
  return {
    task,
    capabilities: {
      canEdit: manageable,
      canUpdateProgress: manageable || (isAssignee && can(actor, "tasks.update_assigned")),
      canCancel: manageable,
      canComment: can(actor, "tasks.comment"),
      isAssignee,
    },
  };
}

function parseTask(input: unknown): TaskData {
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  return parsed.data;
}

async function assertProjectForTasks(tx: Tx, actor: Actor, projectId: string) {
  const project = await tx.project.findFirst({ where: { AND: [projectManageWhere(actor), { id: projectId }] }, select: { id: true, archivedAt: true, status: true } });
  if (!project) throw new ValidationError("Select a project you have access to.", { projectId: "Project not found or not accessible." });
  if (project.archivedAt) throw new ValidationError("Tasks cannot be added to an archived project.", { projectId: "This project is archived." });
  if (project.status === "CANCELLED") throw new ValidationError("Tasks cannot be added to a cancelled project.", { projectId: "This project is cancelled." });
}

async function assertAssignable(tx: Tx, organizationId: string, data: { departmentIds: string[]; assigneeIds: string[] }, keep: { departmentIds: string[]; assigneeIds: string[] }) {
  const newDepartments = data.departmentIds.filter((d) => !keep.departmentIds.includes(d));
  const newUsers = data.assigneeIds.filter((u) => !keep.assigneeIds.includes(u));
  if (newDepartments.length) {
    const n = await tx.department.count({ where: { id: { in: newDepartments }, organizationId, status: "ACTIVE" } });
    if (n !== newDepartments.length) throw new ValidationError("Selected departments must exist and be active.", { departmentIds: "One or more departments are inactive or do not exist." });
  }
  if (newUsers.length) {
    const n = await tx.user.count({ where: { id: { in: newUsers }, organizationId, status: "ACTIVE" } });
    if (n !== newUsers.length) throw new ValidationError("Selected team members must exist and be active.", { assigneeIds: "One or more team members are inactive or do not exist." });
  }
}

/** Recomputes the multi-value sort keys for one task (see filters.ts for the documented semantics). */
async function refreshSortKeys(tx: Tx, taskId: string) {
  await tx.$executeRaw`
    UPDATE tasks SET
      department_sort_key = (SELECT lower(d.name) FROM task_departments td JOIN departments d ON d.id = td.department_id WHERE td.task_id = ${taskId}::uuid ORDER BY lower(d.name) LIMIT 1),
      assignee_sort_key = (SELECT lower(u.full_name) FROM task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = ${taskId}::uuid ORDER BY lower(u.full_name) LIMIT 1)
    WHERE id = ${taskId}::uuid`;
}

async function notify(tx: Tx, userIds: string[], actor: Actor, task: { id: string; code: string; title: string }, title: string) {
  const recipients = userIds.filter((u) => u !== actor.id);
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((userId) => ({ userId, type: "task.assigned", title, body: `${task.code} · ${task.title}`, link: `/tasks/${task.id}` })),
  });
}

type ActivityRow = { action: TaskActivityAction; fromValue?: Prisma.InputJsonValue; toValue?: Prisma.InputJsonValue };

export async function createTask(actor: Actor, input: unknown) {
  if (!can(actor, "tasks.create")) throw new ForbiddenError();
  const data = parseTask(input);
  const transition = applyTaskTransition({ status: "TODO", progress: 0, completedAt: null }, { status: data.status, progress: data.progress });
  if (!transition.ok) throw new ValidationError(transition.error, { [transition.field]: transition.error });

  return db.$transaction(async (tx) => {
    await assertProjectForTasks(tx, actor, data.projectId);
    await assertAssignable(tx, actor.organizationId, data, { departmentIds: [], assigneeIds: [] });
    const code = await nextCode(tx, actor.organizationId, "TASK");
    const task = await tx.task.create({
      data: {
        organizationId: actor.organizationId,
        code,
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        startDate: toDbDate(data.startDate),
        dueDate: toDbDate(data.dueDate),
        priority: data.priority,
        status: transition.state.status,
        progress: transition.state.progress,
        completedAt: transition.state.completedAt,
        ownerId: data.ownerId,
        createdById: actor.id,
        departments: { create: data.departmentIds.map((departmentId) => ({ departmentId })) },
        assignees: { create: data.assigneeIds.map((userId) => ({ userId, assignedById: actor.id })) },
      },
    });
    await refreshSortKeys(tx, task.id);
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: actor.id,
        action: "CREATED",
        toValue: { status: task.status, progress: task.progress, priority: task.priority, assigneeIds: data.assigneeIds, departmentIds: data.departmentIds },
      },
    });
    await notify(tx, data.assigneeIds, actor, task, "You were assigned a task");
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "task.created", entityType: "task", entityId: task.id, summary: `Created task ${code} – ${task.title}` }, tx);
    return task;
  });
}

const names = async (tx: Tx, model: "user" | "department", ids: string[]) => {
  if (!ids.length) return [] as string[];
  const rows = model === "user" ? await tx.user.findMany({ where: { id: { in: ids } }, select: { fullName: true } }) : await tx.department.findMany({ where: { id: { in: ids } }, select: { name: true } });
  return rows.map((r) => ("fullName" in r ? r.fullName : r.name)).sort();
};

/** Optimistic concurrency: the update only applies if `version` still matches. */
async function bumpVersion(tx: Tx, id: string, version: number, data: Prisma.TaskUncheckedUpdateManyInput) {
  const res = await tx.task.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  if (res.count !== 1) throw new ConflictError("This task was changed by someone else. Reload to see the latest version, then try again.");
}

export async function updateTask(actor: Actor, id: string, input: { version: number; data: unknown }) {
  if (!can(actor, "tasks.manage")) throw new ForbiddenError();
  const data = parseTask(input.data);

  return db.$transaction(async (tx) => {
    const before = await tx.task.findFirst({ where: { AND: [taskManageWhere(actor), { id }] }, include: { departments: true, assignees: true } });
    if (!before) {
      const visible = await tx.task.count({ where: { AND: [taskAccessWhere(actor), { id }] } });
      if (visible) throw new ForbiddenError();
      throw new NotFoundError("Task");
    }
    if (before.projectId !== data.projectId) await assertProjectForTasks(tx, actor, data.projectId);
    const prevDepartments = before.departments.map((d) => d.departmentId);
    const prevAssignees = before.assignees.map((a) => a.userId);
    await assertAssignable(tx, actor.organizationId, data, { departmentIds: prevDepartments, assigneeIds: prevAssignees });

    const statusChange = data.status !== before.status ? data.status : undefined;
    const progressChange = data.progress !== before.progress ? data.progress : undefined;
    const transition = applyTaskTransition(
      { status: before.status as TaskStatus, progress: before.progress, completedAt: before.completedAt },
      { status: statusChange, progress: progressChange },
    );
    if (!transition.ok) throw new ValidationError(transition.error, { [transition.field]: transition.error });

    await bumpVersion(tx, id, input.version, {
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      startDate: toDbDate(data.startDate),
      dueDate: toDbDate(data.dueDate),
      priority: data.priority,
      status: transition.state.status,
      progress: transition.state.progress,
      completedAt: transition.state.completedAt,
      ownerId: data.ownerId,
    });

    const addDeps = data.departmentIds.filter((d) => !prevDepartments.includes(d));
    const delDeps = prevDepartments.filter((d) => !data.departmentIds.includes(d));
    const addUsers = data.assigneeIds.filter((u) => !prevAssignees.includes(u));
    const delUsers = prevAssignees.filter((u) => !data.assigneeIds.includes(u));
    if (delDeps.length) await tx.taskDepartment.deleteMany({ where: { taskId: id, departmentId: { in: delDeps } } });
    if (addDeps.length) await tx.taskDepartment.createMany({ data: addDeps.map((departmentId) => ({ taskId: id, departmentId })) });
    if (delUsers.length) await tx.taskAssignee.deleteMany({ where: { taskId: id, userId: { in: delUsers } } });
    if (addUsers.length) await tx.taskAssignee.createMany({ data: addUsers.map((userId) => ({ taskId: id, userId, assignedById: actor.id })) });
    if (addDeps.length || delDeps.length || addUsers.length || delUsers.length) await refreshSortKeys(tx, id);

    const activity: ActivityRow[] = [];
    const edited: Record<string, { from: Prisma.InputJsonValue | null; to: Prisma.InputJsonValue | null }> = {};
    if (before.title !== data.title) edited.title = { from: before.title, to: data.title };
    if ((before.description ?? null) !== data.description) edited.description = { from: before.description ? "(previous text)" : null, to: data.description ? "(updated text)" : null };
    if (before.priority !== data.priority) edited.priority = { from: before.priority, to: data.priority };
    if (fromDbDate(before.startDate) !== (data.startDate ?? "")) edited.startDate = { from: fromDbDate(before.startDate) || null, to: data.startDate };
    if (before.projectId !== data.projectId) edited.projectId = { from: before.projectId, to: data.projectId };
    if (Object.keys(edited).length) activity.push({ action: "EDITED", fromValue: Object.fromEntries(Object.entries(edited).map(([k, v]) => [k, v.from])), toValue: Object.fromEntries(Object.entries(edited).map(([k, v]) => [k, v.to])) });
    if (fromDbDate(before.dueDate) !== (data.dueDate ?? "")) activity.push({ action: "DUE_DATE_CHANGED", fromValue: fromDbDate(before.dueDate) || undefined, toValue: data.dueDate ?? undefined });
    if (addUsers.length || delUsers.length) activity.push({ action: "ASSIGNEES_CHANGED", fromValue: await names(tx, "user", prevAssignees), toValue: await names(tx, "user", data.assigneeIds) });
    if (addDeps.length || delDeps.length) activity.push({ action: "DEPARTMENTS_CHANGED", fromValue: await names(tx, "department", prevDepartments), toValue: await names(tx, "department", data.departmentIds) });
    if (before.ownerId !== data.ownerId) activity.push({ action: "OWNER_CHANGED", fromValue: (await names(tx, "user", before.ownerId ? [before.ownerId] : []))[0] ?? null, toValue: (await names(tx, "user", data.ownerId ? [data.ownerId] : []))[0] ?? null });
    activity.push(...transitionActivity(before, transition.state, transition));
    if (activity.length) await tx.taskActivity.createMany({ data: activity.map((a) => ({ ...a, taskId: id, actorId: actor.id })) });

    const task = await tx.task.findUniqueOrThrow({ where: { id } });
    await notify(tx, addUsers, actor, task, "You were assigned a task");
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "task.updated", entityType: "task", entityId: id, summary: `Updated task ${task.code}`, metadata: { changes: activity.map((a) => a.action) } }, tx);
    return task;
  });
}

function transitionActivity(
  before: { status: string; progress: number },
  after: { status: string; progress: number },
  flags: { completed: boolean; reopened: boolean },
): ActivityRow[] {
  const rows: ActivityRow[] = [];
  if (flags.completed) rows.push({ action: "COMPLETED", fromValue: before.status, toValue: after.status });
  else if (flags.reopened) rows.push({ action: "REOPENED", fromValue: before.status, toValue: after.status });
  else if (before.status !== after.status) rows.push({ action: "STATUS_CHANGED", fromValue: before.status, toValue: after.status });
  if (before.progress !== after.progress) rows.push({ action: "PROGRESS_CHANGED", fromValue: before.progress, toValue: after.progress });
  return rows;
}

/** Status / progress update — available to managers and to the task's own assignees. */
export async function updateTaskProgress(actor: Actor, input: unknown) {
  const parsed = progressUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const { taskId, version, status, progress } = parsed.data;

  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { AND: [taskAccessWhere(actor), { id: taskId }] }, include: { assignees: true, project: { select: { archivedAt: true } } } });
    if (!task) throw new NotFoundError("Task");
    const manageable = can(actor, "tasks.manage") && (await tx.task.count({ where: { AND: [taskManageWhere(actor), { id: taskId }] } })) > 0;
    const isAssignee = task.assignees.some((a) => a.userId === actor.id);
    if (!manageable && !(isAssignee && can(actor, "tasks.update_assigned"))) throw new ForbiddenError("Only the task's assignees or managers can update it.");
    if (!manageable && (status === "CANCELLED" || task.status === "CANCELLED")) throw new ForbiddenError("Only a manager can cancel or restore a cancelled task.");

    const transition = applyTaskTransition(
      { status: task.status as TaskStatus, progress: task.progress, completedAt: task.completedAt },
      { status: status !== task.status ? status : undefined, progress: progress !== task.progress ? progress : undefined },
    );
    if (!transition.ok) throw new ValidationError(transition.error, { [transition.field]: transition.error });
    const after = transition.state;
    if (after.status === task.status && after.progress === task.progress) return task;

    await bumpVersion(tx, taskId, version, { status: after.status, progress: after.progress, completedAt: after.completedAt });
    const activity = transitionActivity(task, after, transition);
    await tx.taskActivity.createMany({ data: activity.map((a) => ({ ...a, taskId, actorId: actor.id })) });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "task.progress_updated", entityType: "task", entityId: taskId, summary: `${task.code}: ${task.status}/${task.progress}% → ${after.status}/${after.progress}%` }, tx);
    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
}

export async function addComment(actor: Actor, input: unknown) {
  if (!can(actor, "tasks.comment")) throw new ForbiddenError();
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const task = await db.task.findFirst({ where: { AND: [taskAccessWhere(actor), { id: parsed.data.taskId }] }, include: { assignees: true } });
  if (!task) throw new NotFoundError("Task");
  return db.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({ data: { taskId: task.id, authorId: actor.id, body: parsed.data.body } });
    await tx.taskActivity.create({ data: { taskId: task.id, actorId: actor.id, action: "COMMENT_ADDED", toValue: { commentId: comment.id } } });
    const recipients = [...new Set([...task.assignees.map((a) => a.userId), task.createdById])];
    await tx.notification.createMany({
      data: recipients.filter((u) => u !== actor.id).map((userId) => ({ userId, type: "task.comment", title: "New comment on a task", body: `${task.code} · ${task.title}`, link: `/tasks/${task.id}` })),
    });
    return comment;
  });
}
