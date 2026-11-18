import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createDepartment, addDepartmentMember, getDepartment, removeDepartmentMember } from "@/modules/departments/service";
import { createMember, issueMemberResetLink, setMemberStatus, updateMember } from "@/modules/members/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/tasks/service";
import { getReport, reportWhatsAppText } from "@/modules/reports/service";
import { updateRolePermissions } from "@/modules/settings/service";
import { actorFor, standardFixture } from "./helpers";

let fx: Awaited<ReturnType<typeof standardFixture>>;
async function errorOf(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("Expected rejection");
}
beforeEach(async () => {
  fx = await standardFixture();
});

const member = (extra: Record<string, unknown> = {}) => ({
  fullName: "Neha Verma",
  email: "neha@example.test",
  username: "neha.v",
  phone: "+91 98100 00000",
  whatsappNumber: "9810000000",
  designation: "Site Engineer",
  joiningDate: "2026-01-15",
  role: "USER",
  primaryDepartmentId: null,
  additionalDepartmentIds: [],
  password: "Initial-pass-2026",
  ...extra,
});

describe("departments & members", () => {
  it("creates members in multiple departments with one primary, prevents duplicates", async () => {
    const civil = await createDepartment(fx.actors.admin, { name: "Civil" });
    const elec = await createDepartment(fx.actors.admin, { name: "Electrical" });
    expect(civil.code).toBe("DEP-001");
    expect((await errorOf(createDepartment(fx.actors.admin, { name: "civil" }))).code).toBe("CONFLICT");

    const user = (await createMember(fx.actors.admin, member({ primaryDepartmentId: civil.id, additionalDepartmentIds: [elec.id, civil.id] })))!;
    expect(user.employeeCode).toMatch(/^EMP-\d{4}$/);
    expect(user.mustChangePassword).toBe(true);
    expect(user.primaryDepartmentId).toBe(civil.id);
    expect(await db.departmentMember.count({ where: { userId: user.id } })).toBe(2);
    expect((await errorOf(addDepartmentMember(fx.actors.admin, { departmentId: civil.id, userId: user.id }))).code).toBe("CONFLICT");
    expect((await getDepartment(fx.actors.admin, elec.id)).department.members).toHaveLength(1);

    expect((await errorOf(createMember(fx.actors.admin, member({ username: "another" })))).fieldErrors?.email).toBeTruthy();
    expect((await errorOf(createMember(fx.actors.admin, member({ email: "x@example.test" })))).fieldErrors?.username).toBeTruthy();
  });

  it("enforces role boundaries", async () => {
    expect((await errorOf(createMember(fx.actors.admin, member({ role: "ADMIN" })))).code).toBe("FORBIDDEN");
    expect((await errorOf(createMember(fx.actors.amit, member()))).code).toBe("FORBIDDEN");
    const admin2 = await createMember(fx.actors.superAdmin, member({ role: "ADMIN" }));
    expect(admin2).toBeTruthy();
    // Admin cannot edit another admin, nor promote a user.
    expect((await errorOf(updateMember(fx.actors.admin, fx.users.otherAdmin.id, { ...member(), email: fx.users.otherAdmin.email, username: fx.users.otherAdmin.username }))).code).toBe("FORBIDDEN");
    expect((await errorOf(updateMember(fx.actors.admin, fx.users.amit.id, { ...member({ role: "ADMIN" }), email: fx.users.amit.email, username: fx.users.amit.username }))).code).toBe("FORBIDDEN");
    // Nobody can deactivate themselves.
    expect((await errorOf(setMemberStatus(fx.actors.superAdmin, fx.users.superAdmin.id, "INACTIVE"))).code).toBe("FORBIDDEN");
  });

  it("deactivation revokes sessions; reset links are admin-only", async () => {
    await db.session.create({ data: { tokenHash: "x".repeat(64), userId: fx.users.amit.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await setMemberStatus(fx.actors.admin, fx.users.amit.id, "INACTIVE");
    expect(await db.session.count({ where: { userId: fx.users.amit.id } })).toBe(0);
    await setMemberStatus(fx.actors.admin, fx.users.amit.id, "ACTIVE");
    expect(await issueMemberResetLink(fx.actors.admin, fx.users.amit.id)).toContain("/reset-password?token=");
    expect((await errorOf(issueMemberResetLink(fx.actors.rahul, fx.users.amit.id))).code).toBe("NOT_FOUND");
  });

  it("an admin cannot change a super admin's department memberships", async () => {
    const civil = await createDepartment(fx.actors.admin, { name: "Civil" });
    expect((await errorOf(addDepartmentMember(fx.actors.admin, { departmentId: civil.id, userId: fx.users.superAdmin.id }))).code).toBe("FORBIDDEN");
    await addDepartmentMember(fx.actors.superAdmin, { departmentId: civil.id, userId: fx.users.superAdmin.id });
    expect((await errorOf(removeDepartmentMember(fx.actors.admin, { departmentId: civil.id, userId: fx.users.superAdmin.id }))).code).toBe("FORBIDDEN");
  });

  it("changing a member's email invalidates outstanding reset links", async () => {
    const link = await issueMemberResetLink(fx.actors.admin, fx.users.amit.id);
    await updateMember(fx.actors.admin, fx.users.amit.id, { ...member(), email: "amit.new@example.test", username: fx.users.amit.username });
    expect(await db.passwordResetToken.count({ where: { userId: fx.users.amit.id, usedAt: null } })).toBe(0);
    expect(link).toContain("token=");
  });

  it("super-admin-only permissions can never be granted to other roles", async () => {
    expect((await errorOf(updateRolePermissions(fx.actors.superAdmin, { role: "ADMIN", permissions: ["audit.view"] }))).code).toBe("FORBIDDEN");
    expect((await errorOf(updateRolePermissions(fx.actors.admin, { role: "ADMIN", permissions: [] }))).code).toBe("FORBIDDEN");
    await updateRolePermissions(fx.actors.superAdmin, { role: "ADMIN", permissions: ["dashboard.view", "projects.view_all"] });
    const refreshed = await actorFor(fx.users.admin.id);
    expect(refreshed.permissions).toEqual(expect.arrayContaining(["projects.view_all"]));
    expect(refreshed.permissions).not.toContain("projects.create");
  });
});

describe("reports", () => {
  it("only includes tasks the requester may see, and enforces report permissions", async () => {
    const project = await createProject(fx.actors.admin, { name: "Site Beta", siteAddress: "Addr", description: "Desc", priority: "MEDIUM", status: "ACTIVE", memberIds: [] });
    const base = { projectId: project.id, departmentIds: [], priority: "MEDIUM", status: "TODO", progress: 0, description: null, startDate: null, dueDate: null };
    await createTask(fx.actors.admin, { ...base, title: "Task for Amit", assigneeIds: [fx.users.amit.id], ownerId: fx.users.amit.id });
    await createTask(fx.actors.admin, { ...base, title: "Task for Rahul", assigneeIds: [fx.users.rahul.id], ownerId: fx.users.rahul.id });

    const projectReport = await getReport(fx.actors.admin, { type: "project", id: project.id });
    expect(projectReport.tasks).toHaveLength(2);

    // USER: own member report only.
    const own = await getReport(fx.actors.amit, { type: "member", id: fx.users.amit.id });
    expect(own.tasks.map((t) => t.title)).toEqual(["Task for Amit"]);
    expect(own.whatsappPhone).toBe("9876543210");
    expect((await errorOf(getReport(fx.actors.amit, { type: "member", id: fx.users.rahul.id }))).code).toBe("FORBIDDEN");
    expect((await errorOf(getReport(fx.actors.amit, { type: "project", id: project.id }))).code).toBe("FORBIDDEN");
    expect((await errorOf(getReport(fx.actors.amit, { type: "global" }))).code).toBe("FORBIDDEN");
    // Other admin has no access to the project.
    expect((await errorOf(getReport(fx.actors.otherAdmin, { type: "project", id: project.id }))).code).toBe("NOT_FOUND");

    const text = reportWhatsAppText(projectReport);
    expect(text).toContain("Project Task List");
    expect(text).toContain("Task for Rahul");
  });
});
