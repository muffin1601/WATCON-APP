/**
 * Added by the 2026-11-18 production-readiness audit to close runtime coverage gaps:
 * project edit/archive, department edit, server-side pagination and the health probe.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createProject, getProject, listProjects, setProjectArchived, updateProject } from "@/modules/projects/service";
import { createDepartment, getDepartment, updateDepartment } from "@/modules/departments/service";
import { createTask, listTasks } from "@/modules/tasks/service";
import { getDashboard } from "@/modules/dashboard/service";
import { GET as health } from "@/app/api/health/route";
import { standardFixture } from "./helpers";

let fx: Awaited<ReturnType<typeof standardFixture>>;
async function errorOf(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("Expected rejection");
}

const projectInput = (extra: Record<string, unknown> = {}) => ({
  name: "Site Beta",
  siteAddress: "Plot 9, Sector 44, Noida",
  description: "Pool plant room",
  priority: "MEDIUM",
  status: "ACTIVE",
  managerId: fx.users.admin.id,
  memberIds: [],
  startDate: "2026-11-01",
  expectedCompletionDate: "2027-02-28",
  ...extra,
});

beforeEach(async () => {
  fx = await standardFixture();
});

describe("projects: edit & archive", () => {
  it("persists edits, enforces who may edit, and archives without deleting", async () => {
    const p = await createProject(fx.actors.admin, projectInput());
    await updateProject(fx.actors.admin, p.id, projectInput({ name: "Site Beta (Phase 2)", priority: "CRITICAL" }));
    const { project } = await getProject(fx.actors.admin, p.id);
    expect(project.name).toBe("Site Beta (Phase 2)");
    expect(project.priority).toBe("CRITICAL");
    expect(project.code).toBe(p.code); // code is immutable

    // A USER has no edit permission; another admin who doesn't manage it cannot see it.
    expect((await errorOf(updateProject(fx.actors.amit, p.id, projectInput()))).code).toBe("FORBIDDEN");
    expect((await errorOf(updateProject(fx.actors.otherAdmin, p.id, projectInput()))).code).toBe("NOT_FOUND");
    expect((await errorOf(setProjectArchived(fx.actors.amit, p.id, true))).code).toBe("FORBIDDEN");

    const before = (await getDashboard(fx.actors.admin)).metrics.totalProjects;
    await setProjectArchived(fx.actors.admin, p.id, true);
    expect((await listProjects(fx.actors.admin, {})).rows.map((r) => r.id)).not.toContain(p.id);
    expect((await listProjects(fx.actors.admin, { archived: "only" })).rows.map((r) => r.id)).toContain(p.id);
    expect((await getDashboard(fx.actors.admin)).metrics.totalProjects).toBe(before - 1);
    expect(await db.project.count({ where: { id: p.id } })).toBe(1); // archived, not deleted
    expect(await db.auditLog.count({ where: { entityId: p.id, action: "project.archived" } })).toBe(1);

    await setProjectArchived(fx.actors.admin, p.id, false);
    expect((await listProjects(fx.actors.admin, {})).rows.map((r) => r.id)).toContain(p.id);
  });
});

describe("departments: edit", () => {
  it("renames a department, sets a head (auto-membership) and rejects non-managers", async () => {
    const d = await createDepartment(fx.actors.admin, { name: "Plumbing" });
    await updateDepartment(fx.actors.admin, d.id, { name: "Plumbing & Drainage", description: "Wet services", headId: fx.users.amit.id });
    const { department } = await getDepartment(fx.actors.admin, d.id);
    expect(department.name).toBe("Plumbing & Drainage");
    expect(department.members.map((m) => m.user.id)).toContain(fx.users.amit.id);
    expect((await errorOf(updateDepartment(fx.actors.amit, d.id, { name: "Hijacked" }))).code).toBe("FORBIDDEN");
  });
});

describe("tasks: server-side pagination", () => {
  it("returns disjoint pages with a correct total", async () => {
    const p = await createProject(fx.actors.admin, projectInput());
    const dept = (await createDepartment(fx.actors.admin, { name: "Electrical" })).id;
    for (let i = 0; i < 12; i++) {
      await createTask(fx.actors.admin, {
        title: `Paged task ${String(i).padStart(2, "0")}`,
        projectId: p.id,
        departmentIds: [dept],
        assigneeIds: [fx.users.amit.id],
        ownerId: fx.users.amit.id,
        priority: "MEDIUM",
        status: "TODO",
        progress: 0,
      });
    }
    const q = { pageSize: "5", sort: "title", dir: "asc" };
    const [p1, p2, p3] = await Promise.all([1, 2, 3].map((page) => listTasks(fx.actors.admin, { ...q, page: String(page) })));
    expect(p1.total).toBe(12);
    expect([p1.rows.length, p2.rows.length, p3.rows.length]).toEqual([5, 5, 2]);
    const ids = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(12);
    // The assignee sees the same 12; an unrelated user sees none.
    expect((await listTasks(fx.actors.amit, {})).total).toBe(12);
    expect((await listTasks(fx.actors.rahul, {})).total).toBe(0);
  });
});

describe("health probe", () => {
  it("reports ok when the database answers", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", db: "up" });
    expect(JSON.stringify(body)).not.toMatch(/postgres|password|localhost/i);
  });
});
