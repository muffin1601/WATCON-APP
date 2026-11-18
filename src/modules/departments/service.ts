import "server-only";
import { db, type Prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextCode } from "@/lib/codes";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation, zodFieldErrors } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions/definitions";
import { taskAccessWhere } from "@/lib/permissions/scopes";
import { OPEN_STATUSES, startOfToday } from "@/modules/tasks/rules";
import { departmentInputSchema, departmentListQuerySchema, membershipSchema } from "./validation";

/** Departments are an organization-wide directory; task numbers are always scoped to the actor. */
export async function listDepartments(actor: Actor, rawQuery: unknown) {
  const query = departmentListQuerySchema.parse(rawQuery ?? {});
  const and: Prisma.DepartmentWhereInput[] = [{ organizationId: actor.organizationId }];
  if (query.status) and.push({ status: query.status });
  if (query.q) and.push({ OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] });
  const where: Prisma.DepartmentWhereInput = { AND: and };
  const scope = taskAccessWhere(actor);

  const [total, rows] = await Promise.all([
    db.department.count({ where }),
    db.department.findMany({
      where,
      orderBy: [{ [query.sort]: query.dir }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        description: true,
        head: { select: { id: true, fullName: true } },
        _count: { select: { members: true, tasks: { where: { task: scope } } } },
      },
    }),
  ]);
  const ids = rows.map((r) => r.id);
  // Two grouped counts for the page instead of per-row queries.
  const [pending, completed] = await Promise.all([
    db.taskDepartment.groupBy({ by: ["departmentId"], where: { departmentId: { in: ids }, task: { AND: [scope, { status: { in: OPEN_STATUSES } }] } }, _count: { _all: true } }),
    db.taskDepartment.groupBy({ by: ["departmentId"], where: { departmentId: { in: ids }, task: { AND: [scope, { status: "COMPLETED" }] } }, _count: { _all: true } }),
  ]);
  const p = new Map(pending.map((g) => [g.departmentId, g._count._all]));
  const c = new Map(completed.map((g) => [g.departmentId, g._count._all]));
  return {
    rows: rows.map((r) => ({
      ...r,
      memberCount: r._count.members,
      taskCount: r._count.tasks,
      pendingCount: p.get(r.id) ?? 0,
      completedCount: c.get(r.id) ?? 0,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    query,
  };
}

export async function getDepartment(actor: Actor, id: string) {
  const department = await db.department.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: {
      head: { select: { id: true, fullName: true, designation: true } },
      members: {
        where: can(actor, "members.view") ? {} : { userId: actor.id },
        include: { user: { select: { id: true, fullName: true, designation: true, employeeCode: true, status: true, primaryDepartmentId: true } } },
        orderBy: { user: { fullName: "asc" } },
      },
      _count: { select: { members: true } },
    },
  });
  if (!department) throw new NotFoundError("Department");
  const scope: Prisma.TaskWhereInput = { AND: [taskAccessWhere(actor), { departments: { some: { departmentId: id } } }] };
  const today = startOfToday();
  const [total, pending, completed, overdue] = await Promise.all([
    db.task.count({ where: scope }),
    db.task.count({ where: { AND: [scope, { status: { in: OPEN_STATUSES } }] } }),
    db.task.count({ where: { AND: [scope, { status: "COMPLETED" }] } }),
    db.task.count({ where: { AND: [scope, { status: { in: OPEN_STATUSES } }, { dueDate: { lt: today } }] } }),
  ]);
  return {
    department,
    counts: { total, pending, completed, overdue },
    capabilities: { canManage: can(actor, "departments.manage"), canReport: can(actor, "reports.view") },
  };
}

export async function listDepartmentOptions(actor: Actor, opts: { activeOnly?: boolean } = {}) {
  return db.department.findMany({
    where: { organizationId: actor.organizationId, ...(opts.activeOnly ? { status: "ACTIVE" } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, status: true },
  });
}

function parse(input: unknown) {
  const parsed = departmentInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  return parsed.data;
}

async function assertHead(organizationId: string, headId: string | null) {
  if (!headId) return;
  const ok = await db.user.count({ where: { id: headId, organizationId, status: "ACTIVE" } });
  if (!ok) throw new ValidationError("Department head must be an active team member.", { headId: "Select an active team member." });
}

async function assertNameFree(organizationId: string, name: string, exceptId?: string) {
  const clash = await db.department.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ConflictError("A department with this name already exists.", { name: "A department with this name already exists." });
}

export async function createDepartment(actor: Actor, input: unknown) {
  if (!can(actor, "departments.manage")) throw new ForbiddenError();
  const data = parse(input);
  await assertHead(actor.organizationId, data.headId);
  await assertNameFree(actor.organizationId, data.name);
  try {
    return await db.$transaction(async (tx) => {
      const code = await nextCode(tx, actor.organizationId, "DEPARTMENT");
      const department = await tx.department.create({ data: { ...data, code, organizationId: actor.organizationId } });
      // The head is automatically a member of the department.
      if (data.headId) await tx.departmentMember.create({ data: { departmentId: department.id, userId: data.headId } });
      await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "department.created", entityType: "department", entityId: department.id, summary: `Created department ${code} – ${department.name}` }, tx);
      return department;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("A department with this name already exists.", { name: "A department with this name already exists." });
    throw e;
  }
}

export async function updateDepartment(actor: Actor, id: string, input: unknown) {
  if (!can(actor, "departments.manage")) throw new ForbiddenError();
  const data = parse(input);
  const before = await db.department.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!before) throw new NotFoundError("Department");
  if (data.headId !== before.headId) await assertHead(actor.organizationId, data.headId);
  await assertNameFree(actor.organizationId, data.name, id);
  try {
    return await db.$transaction(async (tx) => {
      const department = await tx.department.update({ where: { id }, data });
      if (data.headId) {
        await tx.departmentMember.upsert({
          where: { departmentId_userId: { departmentId: id, userId: data.headId } },
          create: { departmentId: id, userId: data.headId },
          update: {},
        });
      }
      if (before.name !== department.name) await refreshDepartmentSortKeys(tx, id);
      await writeAudit(
        {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: before.status !== department.status ? (department.status === "ACTIVE" ? "department.activated" : "department.deactivated") : "department.updated",
          entityType: "department",
          entityId: id,
          summary: `Updated department ${department.code}`,
        },
        tx,
      );
      return department;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("A department with this name already exists.", { name: "A department with this name already exists." });
    throw e;
  }
}

/** Keeps task sort keys correct after a department rename. */
async function refreshDepartmentSortKeys(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], departmentId: string) {
  await tx.$executeRaw`
    UPDATE tasks t SET department_sort_key = (
      SELECT lower(d.name) FROM task_departments td JOIN departments d ON d.id = td.department_id
      WHERE td.task_id = t.id ORDER BY lower(d.name) LIMIT 1)
    WHERE t.id IN (SELECT task_id FROM task_departments WHERE department_id = ${departmentId}::uuid)`;
}

export async function setDepartmentStatus(actor: Actor, id: string, status: "ACTIVE" | "INACTIVE") {
  if (!can(actor, "departments.manage")) throw new ForbiddenError();
  const before = await db.department.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!before) throw new NotFoundError("Department");
  if (before.status === status) return before;
  // Deactivation keeps memberships and task history intact; it only blocks new assignments.
  return db.$transaction(async (tx) => {
    const department = await tx.department.update({ where: { id }, data: { status } });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: status === "ACTIVE" ? "department.activated" : "department.deactivated", entityType: "department", entityId: id, summary: `${status === "ACTIVE" ? "Activated" : "Deactivated"} department ${department.code}` }, tx);
    return department;
  });
}

/** Only a Super Admin may change a Super Admin's records (incl. department memberships). */
function assertMayChangeMembership(actor: Actor, targetRole: string) {
  if (targetRole === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Only a Super Admin can change a Super Admin's department memberships.");
  }
}

export async function addDepartmentMember(actor: Actor, input: unknown) {
  if (!can(actor, "departments.manage")) throw new ForbiddenError();
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid membership.");
  const { departmentId, userId } = parsed.data;
  const [department, user] = await Promise.all([
    db.department.findFirst({ where: { id: departmentId, organizationId: actor.organizationId } }),
    db.user.findFirst({ where: { id: userId, organizationId: actor.organizationId }, include: { role: { select: { key: true } } } }),
  ]);
  if (!department) throw new NotFoundError("Department");
  if (!user) throw new NotFoundError("Team member");
  assertMayChangeMembership(actor, user.role.key);
  if (department.status !== "ACTIVE") throw new ValidationError("Members cannot be added to an inactive department.");
  if (user.status !== "ACTIVE") throw new ValidationError("Inactive team members cannot be added to a department.");
  const exists = await db.departmentMember.findUnique({ where: { departmentId_userId: { departmentId, userId } } });
  if (exists) throw new ConflictError(`${user.fullName} is already a member of ${department.name}.`);
  await db.$transaction(async (tx) => {
    await tx.departmentMember.create({ data: { departmentId, userId } });
    if (!user.primaryDepartmentId) await tx.user.update({ where: { id: userId }, data: { primaryDepartmentId: departmentId } });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "department.member_added", entityType: "department", entityId: departmentId, summary: `Added ${user.fullName} to ${department.name}` }, tx);
  });
}

export async function removeDepartmentMember(actor: Actor, input: unknown) {
  if (!can(actor, "departments.manage")) throw new ForbiddenError();
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid membership.");
  const { departmentId, userId } = parsed.data;
  const membership = await db.departmentMember.findFirst({
    where: { departmentId, userId, department: { organizationId: actor.organizationId } },
    include: { user: { include: { role: { select: { key: true } } } }, department: true },
  });
  if (!membership) throw new NotFoundError("Membership");
  assertMayChangeMembership(actor, membership.user.role.key);
  await db.$transaction(async (tx) => {
    await tx.departmentMember.delete({ where: { departmentId_userId: { departmentId, userId } } });
    if (membership.user.primaryDepartmentId === departmentId) {
      const another = await tx.departmentMember.findFirst({ where: { userId }, orderBy: { joinedAt: "asc" } });
      await tx.user.update({ where: { id: userId }, data: { primaryDepartmentId: another?.departmentId ?? null } });
    }
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "department.member_removed", entityType: "department", entityId: departmentId, summary: `Removed ${membership.user.fullName} from ${membership.department.name}` }, tx);
  });
}
