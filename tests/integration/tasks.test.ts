import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createProject, getProject, addStatusUpdate, listStatusUpdates } from "@/modules/projects/service";
import { createDepartment, getDepartment, setDepartmentStatus } from "@/modules/departments/service";
import { addComment, createTask, getTask, listTasks, updateTask, updateTaskProgress } from "@/modules/tasks/service";
import { getMember } from "@/modules/members/service";
import { getDashboard } from "@/modules/dashboard/service";
import { standardFixture } from "./helpers";

let fx: Awaited<ReturnType<typeof standardFixture>>;
let projectId: string;
let electrical: string;
let hse: string;

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
  const project = await createProject(fx.actors.admin, {
    name: "Site Alpha",
    siteAddress: "Plot 4, Sector 18, Gurugram",
    description: "Commercial building fit-out",
    priority: "HIGH",
    status: "ACTIVE",
    managerId: fx.users.admin.id,
    memberIds: [],
    startDate: "2026-11-01",
    expectedCompletionDate: "2027-03-31",
  });
  projectId = project.id;
  electrical = (await createDepartment(fx.actors.admin, { name: "Electrical" })).id;
  hse = (await createDepartment(fx.actors.admin, { name: "HSE" })).id;
});

function panelTask(extra: Record<string, unknown> = {}) {
  return {
    title: "Install Electrical Panel",
    description: "Main LT panel installation on ground floor",
    projectId,
    departmentIds: [electrical, hse],
    assigneeIds: [fx.users.amit.id, fx.users.rahul.id, fx.users.sara.id],
    ownerId: fx.users.amit.id,
    startDate: "2026-11-10",
    dueDate: "2026-11-30",
    priority: "HIGH",
    status: "TODO",
    progress: 0,
    ...extra,
  };
}

describe("task creation & multi-assignment", () => {
  it("creates ONE task visible to every assignee, both departments, the project and the global register", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    expect(task.code).toMatch(/^TSK-\d{5}$/);
    expect(await db.task.count()).toBe(1);
    expect(await db.taskAssignee.count({ where: { taskId: task.id } })).toBe(3);
    expect(await db.taskDepartment.count({ where: { taskId: task.id } })).toBe(2);

    for (const who of [fx.actors.amit, fx.actors.rahul, fx.actors.sara]) {
      const list = await listTasks(who, {});
      expect(list.rows.map((r) => r.id)).toEqual([task.id]);
    }
    for (const dept of [electrical, hse]) {
      expect((await listTasks(fx.actors.admin, { departmentId: dept })).total).toBe(1);
      expect((await getDepartment(fx.actors.admin, dept)).counts.total).toBe(1);
    }
    expect((await listTasks(fx.actors.admin, { projectId })).total).toBe(1);
    expect((await getProject(fx.actors.admin, projectId)).counts.total).toBe(1);
    expect((await getMember(fx.actors.admin, fx.users.sara.id)).counts.total).toBe(1);
    const activity = await db.taskActivity.findMany({ where: { taskId: task.id } });
    expect(activity.map((a) => a.action)).toEqual(["CREATED"]);
    expect(await db.notification.count({ where: { userId: fx.users.amit.id } })).toBe(1);
  });

  it("validates owner ∈ assignees, dates, active departments/members and project access", async () => {
    expect((await errorOf(createTask(fx.actors.admin, panelTask({ ownerId: fx.users.otherAdmin.id })))).fieldErrors?.ownerId).toBeTruthy();
    expect((await errorOf(createTask(fx.actors.admin, panelTask({ dueDate: "2026-11-01" })))).fieldErrors?.dueDate).toBeTruthy();
    expect((await errorOf(createTask(fx.actors.admin, panelTask({ progress: 101 })))).code).toBe("VALIDATION");
    await setDepartmentStatus(fx.actors.admin, hse, "INACTIVE");
    expect((await errorOf(createTask(fx.actors.admin, panelTask()))).fieldErrors?.departmentIds).toBeTruthy();
    // Another admin who is not on the project cannot create tasks in it.
    expect((await errorOf(createTask(fx.actors.otherAdmin, panelTask({ departmentIds: [electrical] })))).fieldErrors?.projectId).toBeTruthy();
    // Users cannot create tasks at all.
    expect((await errorOf(createTask(fx.actors.amit, panelTask({ departmentIds: [electrical] })))).code).toBe("FORBIDDEN");
  });

  it("keeps task history when a department is deactivated", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    await setDepartmentStatus(fx.actors.admin, hse, "INACTIVE");
    expect(await db.taskDepartment.count({ where: { taskId: task.id, departmentId: hse } })).toBe(1);
  });
});

describe("authorization (IDOR)", () => {
  it("a user cannot see or update a task they are not assigned to", async () => {
    const task = await createTask(fx.actors.admin, panelTask({ assigneeIds: [fx.users.amit.id], ownerId: fx.users.amit.id }));
    expect((await errorOf(getTask(fx.actors.rahul, task.id))).code).toBe("NOT_FOUND");
    expect((await errorOf(updateTaskProgress(fx.actors.rahul, { taskId: task.id, version: task.version, progress: 50 }))).code).toBe("NOT_FOUND");
    expect((await listTasks(fx.actors.rahul, {})).total).toBe(0);
    expect((await errorOf(getProject(fx.actors.rahul, projectId))).code).toBe("NOT_FOUND");
    // Another admin without project membership cannot see it either.
    expect((await errorOf(getTask(fx.actors.otherAdmin, task.id))).code).toBe("NOT_FOUND");
    expect((await getTask(fx.actors.superAdmin, task.id)).capabilities.canEdit).toBe(true);
  });

  it("assignees cannot edit, reassign or cancel tasks", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    expect((await errorOf(updateTask(fx.actors.amit, task.id, { version: task.version, data: panelTask({ title: "Hacked" }) }))).code).toBe("FORBIDDEN");
    expect((await errorOf(updateTaskProgress(fx.actors.amit, { taskId: task.id, version: task.version, status: "CANCELLED" }))).code).toBe("FORBIDDEN");
  });
});

describe("status & progress", () => {
  it("assignee updates progress; admin sees it; activity is recorded", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    const updated = await updateTaskProgress(fx.actors.amit, { taskId: task.id, version: task.version, progress: 40 });
    expect(updated.status).toBe("IN_PROGRESS"); // R2 auto-start
    expect(updated.progress).toBe(40);
    const seen = await getTask(fx.actors.admin, task.id);
    expect(seen.task.progress).toBe(40);
    const actions = seen.task.activity.map((a) => a.action);
    expect(actions).toContain("STATUS_CHANGED");
    expect(actions).toContain("PROGRESS_CHANGED");

    const done = await updateTaskProgress(fx.actors.rahul, { taskId: task.id, version: updated.version, status: "COMPLETED" });
    expect(done.progress).toBe(100);
    expect(done.completedAt).not.toBeNull();

    // Reopen requires progress < 100.
    expect((await errorOf(updateTaskProgress(fx.actors.amit, { taskId: task.id, version: done.version, status: "IN_PROGRESS" }))).code).toBe("VALIDATION");
    const reopened = await updateTaskProgress(fx.actors.amit, { taskId: task.id, version: done.version, status: "IN_PROGRESS", progress: 80 });
    expect(reopened.completedAt).toBeNull();
    const finalActions = (await db.taskActivity.findMany({ where: { taskId: task.id } })).map((a) => a.action);
    expect(finalActions).toContain("COMPLETED");
    expect(finalActions).toContain("REOPENED");
  });

  it("detects concurrent updates with optimistic versioning", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    const results = await Promise.allSettled([
      updateTaskProgress(fx.actors.amit, { taskId: task.id, version: task.version, progress: 30 }),
      updateTaskProgress(fx.actors.rahul, { taskId: task.id, version: task.version, progress: 60 }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0]!.reason as AppError).code).toBe("CONFLICT");
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).version).toBe(2);
  });

  it("records edit, reassignment, department and due-date changes", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    await updateTask(fx.actors.admin, task.id, {
      version: task.version,
      data: panelTask({ title: "Install main LT panel", assigneeIds: [fx.users.amit.id, fx.users.sara.id], departmentIds: [electrical], dueDate: "2026-12-05" }),
    });
    const actions = (await db.taskActivity.findMany({ where: { taskId: task.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(["ASSIGNEES_CHANGED", "CREATED", "DEPARTMENTS_CHANGED", "DUE_DATE_CHANGED", "EDITED"].sort());
    expect((await listTasks(fx.actors.rahul, {})).total).toBe(0);
  });

  it("adds comments visible to the team", async () => {
    const task = await createTask(fx.actors.admin, panelTask());
    await addComment(fx.actors.sara, { taskId: task.id, body: "Panel delivered to site." });
    const { task: t } = await getTask(fx.actors.amit, task.id);
    expect(t.comments[0]?.body).toBe("Panel delivered to site.");
  });
});

describe("combined filters & sorting", () => {
  it("combines project + department + member + status + due range + overdue", async () => {
    const a = await createTask(fx.actors.admin, panelTask());
    await createTask(fx.actors.admin, panelTask({ title: "HSE induction", departmentIds: [hse], assigneeIds: [fx.users.sara.id], ownerId: fx.users.sara.id, dueDate: "2026-12-15" }));
    await updateTaskProgress(fx.actors.amit, { taskId: a.id, version: a.version, status: "IN_PROGRESS" });
    const result = await listTasks(fx.actors.admin, {
      projectId,
      departmentId: electrical,
      assigneeId: fx.users.amit.id,
      status: "IN_PROGRESS",
      dueFrom: "2026-11-01",
      dueTo: "2026-11-30",
    });
    expect(result.rows.map((r) => r.id)).toEqual([a.id]);
    expect((await listTasks(fx.actors.admin, { departmentId: hse })).total).toBe(2);
    expect((await listTasks(fx.actors.admin, { assigned: "unassigned" })).total).toBe(0);
    const byAssignee = await listTasks(fx.actors.admin, { sort: "assignee", dir: "asc" });
    expect(byAssignee.rows[0]?.title).toBe("Install Electrical Panel"); // "amit kumar" < "sara khan"
  });
});

describe("projects", () => {
  it("generates unique codes under concurrency and keeps status history append-only", async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createProject(fx.actors.admin, { name: `Site ${i}`, siteAddress: "Addr", description: "Desc", priority: "MEDIUM", status: "PLANNING", memberIds: [] }),
      ),
    );
    expect(new Set(created.map((p) => p.code)).size).toBe(8);

    await addStatusUpdate(fx.actors.admin, { projectId, body: "Electrical installation is currently in progress." });
    await addStatusUpdate(fx.actors.admin, { projectId, body: "Civil work for the second floor is completed." });
    const history = await listStatusUpdates(fx.actors.admin, projectId);
    expect(history.total).toBe(2);
    const { project } = await getProject(fx.actors.admin, projectId);
    expect(project.statusUpdates[0]?.body).toBe("Civil work for the second floor is completed.");
    expect((await errorOf(addStatusUpdate(fx.actors.amit, { projectId, body: "Not allowed" }))).code).toBe("FORBIDDEN");
    expect((await errorOf(addStatusUpdate(fx.actors.otherAdmin, { projectId, body: "Other admin" }))).code).toBe("NOT_FOUND");
  });

  it("dashboard metrics are scoped per user", async () => {
    await createTask(fx.actors.admin, panelTask({ assigneeIds: [fx.users.amit.id], ownerId: fx.users.amit.id, dueDate: "2020-01-31", startDate: null }));
    const adminDash = await getDashboard(fx.actors.admin);
    expect(adminDash.metrics.totalProjects).toBe(1);
    expect(adminDash.metrics.totalTasks).toBe(1);
    expect(adminDash.metrics.overdueTasks).toBe(1);
    const amitDash = await getDashboard(fx.actors.amit);
    expect(amitDash.metrics.totalTasks).toBe(1);
    expect(amitDash.myTasks).toHaveLength(1);
    expect(amitDash.metrics.totalMembers).toBeNull();
    const rahulDash = await getDashboard(fx.actors.rahul);
    expect(rahulDash.metrics.totalTasks).toBe(0);
    expect(rahulDash.metrics.totalProjects).toBe(0);
    expect(rahulDash.quickActions.createTask).toBe(false);
  });
});
