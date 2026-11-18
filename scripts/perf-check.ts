/**
 * Measures the main read paths against the current DATABASE_URL (run after seed:demo).
 *   npx tsx --conditions=react-server scripts/perf-check.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { getDashboard } from "../src/modules/dashboard/service";
import { listTasks } from "../src/modules/tasks/service";
import { listProjects } from "../src/modules/projects/service";
import { listDepartments } from "../src/modules/departments/service";
import { listMembers } from "../src/modules/members/service";
import type { Actor } from "../src/lib/permissions/definitions";

async function actor(role: "SUPER_ADMIN" | "ADMIN" | "USER"): Promise<Actor> {
  const u = await db.user.findFirstOrThrow({ where: { role: { key: role } }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  return { id: u.id, organizationId: u.organizationId, role: u.role.key, permissions: u.role.permissions.map((p) => p.permission.key) };
}

async function time(label: string, fn: () => Promise<unknown>) {
  await fn(); // warm-up
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await fn();
    runs.push(performance.now() - t);
  }
  runs.sort((a, b) => a - b);
  console.log(`${label.padEnd(48)} median ${runs[2]!.toFixed(1)} ms   max ${runs[4]!.toFixed(1)} ms`);
}

async function main() {
  console.log(`tasks in DB: ${await db.task.count()}`);
  for (const role of ["SUPER_ADMIN", "ADMIN", "USER"] as const) {
    const a = await actor(role);
    await time(`${role} dashboard`, () => getDashboard(a));
    await time(`${role} task register (default sort)`, () => listTasks(a, {}));
    await time(`${role} tasks: combined filters + overdue`, () => listTasks(a, { status: "TODO,IN_PROGRESS", priority: "HIGH,CRITICAL", overdue: "1", q: "panel" }));
    await time(`${role} tasks sorted by department, page 20`, () => listTasks(a, { sort: "department", page: "20" }));
    await time(`${role} projects list`, () => listProjects(a, {}));
    await time(`${role} departments list`, () => listDepartments(a, {}));
    if (role !== "USER") await time(`${role} members list`, () => listMembers(a, {}));
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
