import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, defaultPermissionsFor, isSuperAdminOnly, type Actor } from "@/lib/permissions/definitions";
import { memberManageWhere, projectAccessWhere, taskAccessWhere, taskManageWhere } from "@/lib/permissions/scopes";

const actor = (role: Actor["role"], permissions: string[] = defaultPermissionsFor(role)): Actor => ({ id: "u1", organizationId: "o1", role, permissions });

describe("can()", () => {
  it("super admin always passes", () => {
    expect(can(actor("SUPER_ADMIN", []), "audit.view")).toBe(true);
  });
  it("super-admin-only permissions are never granted to other roles, even if stored", () => {
    expect(can(actor("ADMIN", ["audit.view", "settings.roles", "users.manage_admins"]), "audit.view")).toBe(false);
    expect(can(actor("ADMIN", ["users.manage_admins"]), "users.manage_admins")).toBe(false);
  });
  it("default grants match the role matrix", () => {
    const admin = actor("ADMIN");
    const user = actor("USER");
    expect(can(admin, "projects.create")).toBe(true);
    expect(can(admin, "projects.view_all")).toBe(false);
    expect(can(user, "tasks.update_assigned")).toBe(true);
    expect(can(user, "tasks.create")).toBe(false);
    expect(can(user, "members.view")).toBe(false);
    expect(can(user, "reports.view")).toBe(false);
    expect(can(user, "reports.own")).toBe(true);
  });
  it("no default grant includes a super-admin-only permission", () => {
    for (const p of PERMISSIONS) if (isSuperAdminOnly(p.key)) expect(p.defaults).toEqual([]);
  });
});

describe("scopes", () => {
  it("users only see tasks assigned to or owned by them", () => {
    expect(taskAccessWhere(actor("USER"))).toEqual({ organizationId: "o1", OR: [{ assignees: { some: { userId: "u1" } } }, { ownerId: "u1" }] });
  });
  it("admins see their project scope; view_all widens to the organization", () => {
    const w = taskAccessWhere(actor("ADMIN")) as { OR: unknown[] };
    expect(w.OR).toHaveLength(4);
    expect(taskAccessWhere(actor("ADMIN", ["tasks.view_all"]))).toEqual({ organizationId: "o1" });
    expect(projectAccessWhere(actor("ADMIN", ["projects.view_all"]))).toEqual({ organizationId: "o1" });
  });
  it("without tasks.manage nothing is manageable", () => {
    expect(taskManageWhere(actor("USER"))).toEqual({ id: { in: [] } });
  });
  it("admins may only manage non-administrator accounts", () => {
    expect(memberManageWhere(actor("ADMIN"))).toEqual({ organizationId: "o1", role: { key: { notIn: ["SUPER_ADMIN", "ADMIN"] } } });
    expect(memberManageWhere(actor("USER"))).toEqual({ id: { in: [] } });
  });
});
