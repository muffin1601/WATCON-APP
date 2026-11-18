import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/permissions/definitions";
import { taskAccessWhere } from "@/lib/permissions/scopes";
import { OPEN_STATUSES, startOfToday } from "./rules";
import type { TaskListQuery } from "./validation";

const DAY_MS = 86_400_000;
const day = (v: string) => new Date(`${v}T00:00:00.000Z`);

/**
 * Builds the combined task filter. Every condition is AND-ed together, and the
 * actor's visibility scope is always the first condition — filters can only narrow it.
 */
export function buildTaskWhere(actor: Actor, q: Partial<TaskListQuery>, today: Date = startOfToday()): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [taskAccessWhere(actor)];
  if (q.projectId) and.push({ projectId: q.projectId });
  if (q.departmentId) and.push({ departments: { some: { departmentId: q.departmentId } } });
  if (q.assigneeId) and.push({ assignees: { some: { userId: q.assigneeId } } });
  if (q.mine) and.push({ assignees: { some: { userId: actor.id } } });
  if (q.status?.length) and.push({ status: { in: q.status } });
  if (q.priority?.length) and.push({ priority: { in: q.priority } });
  if (q.createdFrom) and.push({ createdAt: { gte: day(q.createdFrom) } });
  if (q.createdTo) and.push({ createdAt: { lt: new Date(day(q.createdTo).getTime() + DAY_MS) } });
  if (q.dueFrom) and.push({ dueDate: { gte: day(q.dueFrom) } });
  if (q.dueTo) and.push({ dueDate: { lte: day(q.dueTo) } });
  if (q.overdue) and.push({ dueDate: { lt: today }, status: { in: OPEN_STATUSES } });
  if (q.assigned === "assigned") and.push({ assignees: { some: {} } });
  if (q.assigned === "unassigned") and.push({ assignees: { none: {} } });
  if (q.q) {
    and.push({
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { code: { contains: q.q, mode: "insensitive" } },
        { description: { contains: q.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

/**
 * Sorting. Multi-valued columns sort by a maintained key:
 *  - department → the alphabetically-first assigned department name (case-insensitive)
 *  - assignee   → the alphabetically-first assigned member's full name (case-insensitive)
 * Tasks without departments/assignees (and without a due date, for dueDate) always sort last.
 * Ties are broken by task code so pagination is stable.
 */
export function buildTaskOrderBy(sort: TaskListQuery["sort"], dir: TaskListQuery["dir"]): Prisma.TaskOrderByWithRelationInput[] {
  const tie: Prisma.TaskOrderByWithRelationInput = { code: "asc" };
  switch (sort) {
    case "dueDate":
      return [{ dueDate: { sort: dir, nulls: "last" } }, tie];
    case "project":
      return [{ project: { name: dir } }, tie];
    case "department":
      return [{ departmentSortKey: { sort: dir, nulls: "last" } }, tie];
    case "assignee":
      return [{ assigneeSortKey: { sort: dir, nulls: "last" } }, tie];
    case "code":
      return [{ code: dir }];
    default:
      return [{ [sort]: dir }, tie];
  }
}
