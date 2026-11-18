import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { formatCode } from "@/lib/codes";
import type { Actor, RoleKey } from "@/lib/permissions/definitions";
import { syncRbac } from "@/modules/auth/rbac-sync";

export const TEST_PASSWORD = "Test-password-123";
let passwordHash: string | null = null;

/** Wipes all business data (keeps roles & permissions) and re-syncs RBAC. */
export async function resetDatabase() {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE notifications, audit_logs, task_activity, task_comments, task_assignees, task_departments,
      tasks, project_status_updates, project_members, projects, department_members, sessions,
      password_reset_tokens, rate_limit_events, code_counters, role_permissions, permissions, roles,
      departments, users, organizations CASCADE;`);
  await syncRbac(db as never);
}

let seq = 0;
export async function createOrg(name = "Test Co") {
  return db.organization.create({ data: { name } });
}

export async function createUser(organizationId: string, role: RoleKey, overrides: Partial<{ fullName: string; status: "ACTIVE" | "INACTIVE"; whatsappNumber: string }> = {}) {
  passwordHash ??= await hashPassword(TEST_PASSWORD);
  seq++;
  const r = await db.role.findUniqueOrThrow({ where: { key: role } });
  return db.user.create({
    data: {
      organizationId,
      employeeCode: formatCode("EMPLOYEE", 9000 + seq),
      username: `user${seq}_${Date.now()}`,
      email: `user${seq}_${Date.now()}@example.test`,
      fullName: overrides.fullName ?? `${role} Person ${seq}`,
      passwordHash,
      roleId: r.id,
      status: overrides.status ?? "ACTIVE",
      whatsappNumber: overrides.whatsappNumber,
    },
  });
}

/** Loads an Actor (with live permissions) the same way the session layer does. */
export async function actorFor(userId: string): Promise<Actor & { fullName: string }> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  return { id: u.id, organizationId: u.organizationId, role: u.role.key, permissions: u.role.permissions.map((p) => p.permission.key), fullName: u.fullName };
}

/** Standard fixture: org, super admin, admin, two users, two departments. */
export async function standardFixture() {
  await resetDatabase();
  const org = await createOrg();
  const superAdmin = await createUser(org.id, "SUPER_ADMIN", { fullName: "Sam Super" });
  const admin = await createUser(org.id, "ADMIN", { fullName: "Alice Admin" });
  const otherAdmin = await createUser(org.id, "ADMIN", { fullName: "Oscar Other" });
  const amit = await createUser(org.id, "USER", { fullName: "Amit Kumar", whatsappNumber: "9876543210" });
  const rahul = await createUser(org.id, "USER", { fullName: "Rahul Singh" });
  const sara = await createUser(org.id, "USER", { fullName: "Sara Khan" });
  return {
    org,
    users: { superAdmin, admin, otherAdmin, amit, rahul, sara },
    actors: {
      superAdmin: await actorFor(superAdmin.id),
      admin: await actorFor(admin.id),
      otherAdmin: await actorFor(otherAdmin.id),
      amit: await actorFor(amit.id),
      rahul: await actorFor(rahul.id),
      sara: await actorFor(sara.id),
    },
  };
}
