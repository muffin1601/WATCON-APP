import "server-only";
import { db, type Prisma, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextCode } from "@/lib/codes";
import { hashPassword } from "@/lib/auth/password";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isUniqueViolation, zodFieldErrors } from "@/lib/errors";
import { can, type Actor, type RoleKey } from "@/lib/permissions/definitions";
import { memberAccessWhere, memberManageWhere, projectAccessWhere, taskAccessWhere } from "@/lib/permissions/scopes";
import { toDbDate } from "@/lib/validations/common";
import { OPEN_STATUSES, startOfToday } from "@/modules/tasks/rules";
import { createAdminResetLink, revokeAllSessions } from "@/modules/auth/service";
import { memberCreateSchema, memberListQuerySchema, memberPasswordResetSchema, memberUpdateSchema } from "./validation";

export async function listMembers(actor: Actor, rawQuery: unknown) {
  const query = memberListQuerySchema.parse(rawQuery ?? {});
  const and: Prisma.UserWhereInput[] = [memberAccessWhere(actor)];
  if (query.status) and.push({ status: query.status });
  if (query.role) and.push({ role: { key: query.role } });
  if (query.departmentId) and.push({ departmentMembership: { some: { departmentId: query.departmentId } } });
  if (query.q) {
    and.push({
      OR: [
        { fullName: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { employeeCode: { contains: query.q, mode: "insensitive" } },
        { designation: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
      ],
    });
  }
  const where: Prisma.UserWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ [query.sort]: query.dir }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        designation: true,
        status: true,
        role: { select: { key: true, name: true } },
        primaryDepartment: { select: { id: true, name: true } },
        departmentMembership: { select: { department: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const scope = taskAccessWhere(actor);
  const [active, completed] = await Promise.all([
    db.taskAssignee.groupBy({ by: ["userId"], where: { userId: { in: ids }, task: { AND: [scope, { status: { in: OPEN_STATUSES } }] } }, _count: { _all: true } }),
    db.taskAssignee.groupBy({ by: ["userId"], where: { userId: { in: ids }, task: { AND: [scope, { status: "COMPLETED" }] } }, _count: { _all: true } }),
  ]);
  const a = new Map(active.map((g) => [g.userId, g._count._all]));
  const c = new Map(completed.map((g) => [g.userId, g._count._all]));
  return {
    rows: rows.map((r) => ({ ...r, activeTasks: a.get(r.id) ?? 0, completedTasks: c.get(r.id) ?? 0 })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    query,
  };
}

export async function getMember(actor: Actor, id: string) {
  const member = await db.user.findFirst({
    where: { AND: [memberAccessWhere(actor), { id }] },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      email: true,
      username: true,
      phone: true,
      whatsappNumber: true,
      designation: true,
      joiningDate: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { key: true, name: true } },
      primaryDepartmentId: true,
      primaryDepartment: { select: { id: true, name: true } },
      departmentMembership: { select: { joinedAt: true, department: { select: { id: true, name: true, code: true, status: true } } }, orderBy: { department: { name: "asc" } } },
    },
  });
  if (!member) throw new NotFoundError("Team member");

  const taskScope: Prisma.TaskWhereInput = { AND: [taskAccessWhere(actor), { assignees: { some: { userId: id } } }] };
  const today = startOfToday();
  const [total, pending, completed, overdue, projects, manageable] = await Promise.all([
    db.task.count({ where: taskScope }),
    db.task.count({ where: { AND: [taskScope, { status: { in: OPEN_STATUSES } }] } }),
    db.task.count({ where: { AND: [taskScope, { status: "COMPLETED" }] } }),
    db.task.count({ where: { AND: [taskScope, { status: { in: OPEN_STATUSES } }, { dueDate: { lt: today } }] } }),
    db.project.findMany({
      where: {
        AND: [
          projectAccessWhere(actor),
          { OR: [{ members: { some: { userId: id } } }, { managerId: id }, { tasks: { some: { assignees: { some: { userId: id } } } } }] },
        ],
      },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.user.count({ where: { AND: [memberManageWhere(actor), { id }] } }),
  ]);
  const isSelf = actor.id === id;
  return {
    member,
    counts: { total, pending, completed, overdue },
    projects,
    capabilities: {
      canEdit: manageable > 0,
      canChangeStatus: manageable > 0 && !isSelf,
      canResetAccess: manageable > 0 && !isSelf,
      canReport: can(actor, "reports.view") || (isSelf && can(actor, "reports.own")),
      isSelf,
    },
  };
}

/** Active people for assignment pickers (organization-wide; names only). */
export async function listMemberOptions(actor: Actor) {
  if (!(can(actor, "tasks.create") || can(actor, "tasks.manage") || can(actor, "members.view") || can(actor, "departments.manage") || can(actor, "projects.edit"))) {
    return [];
  }
  const rows = await db.user.findMany({
    where: { organizationId: actor.organizationId, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, employeeCode: true, designation: true, departmentMembership: { select: { departmentId: true } } },
  });
  return rows.map((r) => ({ id: r.id, fullName: r.fullName, employeeCode: r.employeeCode, designation: r.designation, departmentIds: r.departmentMembership.map((d) => d.departmentId) }));
}

async function assertDepartments(tx: Tx, organizationId: string, ids: string[], keepIds: string[] = []) {
  const toCheck = ids.filter((i) => !keepIds.includes(i));
  if (!toCheck.length) return;
  const found = await tx.department.count({ where: { id: { in: toCheck }, organizationId, status: "ACTIVE" } });
  if (found !== toCheck.length) throw new ValidationError("Selected departments must be active.", { additionalDepartmentIds: "One or more selected departments are inactive or do not exist." });
}

function conflictFrom(e: unknown): never {
  if (isUniqueViolation(e)) {
    const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "");
    if (target.includes("username")) throw new ConflictError("This username is already taken.", { username: "This username is already taken." });
    if (target.includes("email")) throw new ConflictError("An account with this email already exists.", { email: "An account with this email already exists." });
    throw new ConflictError("This email or username is already in use.", { email: "Email or username already in use." });
  }
  throw e;
}

async function assertUniqueIdentity(email: string, username: string, exceptId?: string) {
  const clash = await db.user.findFirst({
    where: { OR: [{ email }, { username }], ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { email: true, username: true },
  });
  if (clash?.email === email) throw new ConflictError("An account with this email already exists.", { email: "An account with this email already exists." });
  if (clash?.username === username) throw new ConflictError("This username is already taken.", { username: "This username is already taken." });
}

function assertRoleAllowed(actor: Actor, role: RoleKey) {
  if (role !== "USER" && !can(actor, "users.manage_admins")) {
    throw new ForbiddenError("Only a Super Admin can create or promote administrators.");
  }
}

export async function createMember(actor: Actor, input: unknown) {
  if (!can(actor, "members.manage")) throw new ForbiddenError();
  const parsed = memberCreateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const data = parsed.data;
  assertRoleAllowed(actor, data.role);
  await assertUniqueIdentity(data.email, data.username);
  const departmentIds = [...new Set([...(data.primaryDepartmentId ? [data.primaryDepartmentId] : []), ...data.additionalDepartmentIds])];
  const passwordHash = await hashPassword(data.password);
  try {
    return await db.$transaction(async (tx) => {
      await assertDepartments(tx, actor.organizationId, departmentIds);
      const role = await tx.role.findUniqueOrThrow({ where: { key: data.role } });
      const employeeCode = await nextCode(tx, actor.organizationId, "EMPLOYEE");
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          employeeCode,
          fullName: data.fullName,
          email: data.email,
          username: data.username,
          phone: data.phone,
          whatsappNumber: data.whatsappNumber,
          designation: data.designation,
          joiningDate: toDbDate(data.joiningDate),
          passwordHash,
          mustChangePassword: true,
          roleId: role.id,
          primaryDepartmentId: data.primaryDepartmentId ?? departmentIds[0] ?? null,
          createdById: actor.id,
          departmentMembership: { create: departmentIds.map((departmentId) => ({ departmentId })) },
        },
      });
      await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "user.created", entityType: "user", entityId: user.id, summary: `Created ${data.role === "ADMIN" ? "administrator" : "team member"} ${employeeCode} – ${user.fullName}`, metadata: { role: data.role } }, tx);
      return user;
    });
  } catch (e) {
    conflictFrom(e);
  }
}

export async function updateMember(actor: Actor, id: string, input: unknown) {
  const parsed = memberUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const data = parsed.data;
  const before = await db.user.findFirst({
    where: { AND: [memberManageWhere(actor), { id }] },
    include: { role: true, departmentMembership: true },
  });
  if (!before) {
    const visible = await db.user.count({ where: { AND: [memberAccessWhere(actor), { id }] } });
    if (visible) throw new ForbiddenError();
    throw new NotFoundError("Team member");
  }
  const roleChanged = before.role.key !== data.role;
  if (roleChanged) {
    if (before.role.key === "SUPER_ADMIN") throw new ForbiddenError("A Super Admin's role cannot be changed from the application.");
    if (data.role === "SUPER_ADMIN") throw new ForbiddenError("Super Admin accounts can only be created with the secure bootstrap procedure.");
    if (actor.id === id) throw new ForbiddenError("You cannot change your own role.");
    assertRoleAllowed(actor, data.role);
    if (!can(actor, "users.manage_admins")) throw new ForbiddenError();
  }
  await assertUniqueIdentity(data.email, data.username, id);
  const departmentIds = [...new Set([...(data.primaryDepartmentId ? [data.primaryDepartmentId] : []), ...data.additionalDepartmentIds])];
  const current = before.departmentMembership.map((m) => m.departmentId);
  const toAdd = departmentIds.filter((d) => !current.includes(d));
  const toRemove = current.filter((d) => !departmentIds.includes(d));
  try {
    return await db.$transaction(async (tx) => {
      // Existing memberships of now-inactive departments may be kept; new ones must be active.
      await assertDepartments(tx, actor.organizationId, toAdd);
      const role = roleChanged ? await tx.role.findUniqueOrThrow({ where: { key: data.role } }) : null;
      const user = await tx.user.update({
        where: { id },
        data: {
          fullName: data.fullName,
          email: data.email,
          username: data.username,
          phone: data.phone,
          whatsappNumber: data.whatsappNumber,
          designation: data.designation,
          joiningDate: toDbDate(data.joiningDate),
          primaryDepartmentId: data.primaryDepartmentId ?? departmentIds[0] ?? null,
          ...(role ? { roleId: role.id } : {}),
          departmentMembership: {
            deleteMany: toRemove.length ? { departmentId: { in: toRemove } } : undefined,
            create: toAdd.map((departmentId) => ({ departmentId })),
          },
        },
      });
      if (before.fullName !== user.fullName) {
        await tx.$executeRaw`
          UPDATE tasks t SET assignee_sort_key = (
            SELECT lower(u.full_name) FROM task_assignees ta JOIN users u ON u.id = ta.user_id
            WHERE ta.task_id = t.id ORDER BY lower(u.full_name) LIMIT 1)
          WHERE t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ${id}::uuid)`;
      }
      if (roleChanged) await tx.session.deleteMany({ where: { userId: id } });
      // A reset link emailed to the OLD address must not stay usable after the
      // account's identity changes.
      if (before.email !== user.email || before.username !== user.username) {
        await tx.passwordResetToken.deleteMany({ where: { userId: id, usedAt: null } });
      }
      await writeAudit(
        {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: roleChanged ? "user.role_changed" : "user.updated",
          entityType: "user",
          entityId: id,
          summary: roleChanged ? `Changed role of ${user.fullName} from ${before.role.key} to ${data.role}` : `Updated team member ${user.employeeCode}`,
          metadata: { departmentsAdded: toAdd.length, departmentsRemoved: toRemove.length },
        },
        tx,
      );
      return user;
    });
  } catch (e) {
    conflictFrom(e);
  }
}

async function findManageableOther(actor: Actor, id: string) {
  if (actor.id === id) throw new ForbiddenError("You cannot perform this action on your own account.");
  const user = await db.user.findFirst({ where: { AND: [memberManageWhere(actor), { id }] }, include: { role: true } });
  if (!user) {
    const visible = await db.user.count({ where: { AND: [memberAccessWhere(actor), { id }] } });
    if (visible) throw new ForbiddenError();
    throw new NotFoundError("Team member");
  }
  return user;
}

export async function setMemberStatus(actor: Actor, id: string, status: "ACTIVE" | "INACTIVE") {
  const user = await findManageableOther(actor, id);
  if (user.status === status) return user;
  if (status === "INACTIVE" && user.role.key === "SUPER_ADMIN") {
    const others = await db.user.count({ where: { organizationId: actor.organizationId, status: "ACTIVE", role: { key: "SUPER_ADMIN" }, id: { not: id } } });
    if (!others) throw new ValidationError("The last active Super Admin cannot be deactivated.");
  }
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: { status } });
    if (status === "INACTIVE") await tx.session.deleteMany({ where: { userId: id } });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: status === "ACTIVE" ? "user.activated" : "user.deactivated", entityType: "user", entityId: id, summary: `${status === "ACTIVE" ? "Activated" : "Deactivated"} ${u.fullName}` }, tx);
    return u;
  });
  return updated;
}

/** Issues a one-time reset link for an employee and signs them out everywhere. */
export async function issueMemberResetLink(actor: Actor, id: string): Promise<string> {
  const user = await findManageableOther(actor, id);
  if (user.status !== "ACTIVE") throw new ValidationError("Activate the account before resetting its access.");
  const link = await createAdminResetLink(id);
  await revokeAllSessions(id);
  await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "user.reset_link_issued", entityType: "user", entityId: id, summary: `Issued password reset link for ${user.fullName}` });
  return link;
}

/** Super Admin directly resets an employee's password and signs them out everywhere. */
export async function resetMemberPassword(actor: Actor, id: string, input: unknown) {
  const parsed = memberPasswordResetSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please correct the highlighted fields.", zodFieldErrors(parsed.error.issues));
  const user = await findManageableOther(actor, id);
  const passwordHash = await hashPassword(parsed.data.password);
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: id, usedAt: null } });
    await writeAudit({ organizationId: actor.organizationId, actorId: actor.id, action: "user.password_reset_by_admin", entityType: "user", entityId: id, summary: `Reset password for ${u.fullName}` }, tx);
    return u;
  });
  return updated;
}
