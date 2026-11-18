/**
 * DEVELOPMENT / LOAD-TEST ONLY. Fills a local database with realistic volumes
 * (departments, ~40 people, 25 projects, N tasks with multi-assignments).
 *
 *   npm run seed:demo -- --tasks 5000
 *
 * Refuses to run when NODE_ENV=production or when the database name does not end
 * in _dev / _test / _e2e. Demo accounts use a password from DEMO_PASSWORD (required).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { formatCode } from "../src/lib/codes";
import { syncRbac } from "../src/modules/auth/rbac-sync";

const url = process.env.DATABASE_URL ?? "";
const dbName = new URL(url).pathname.slice(1);
if (process.env.NODE_ENV === "production" || !/_(dev|test|e2e)$/.test(dbName)) {
  console.error(`Refusing to seed demo data into "${dbName}".`);
  process.exit(1);
}
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10) {
  console.error("Set DEMO_PASSWORD (10+ chars) for the demo accounts.");
  process.exit(1);
}
const taskCount = Number(process.argv[process.argv.indexOf("--tasks") + 1]) || 3000;

const DEPTS = ["Civil", "Electrical", "Mechanical", "Procurement", "HSE", "Operations", "Finance", "Administration"];
const FIRST = ["Amit", "Rahul", "Sara", "Neha", "Vikram", "Priya", "Arjun", "Kavya", "Rohan", "Anjali", "Deepak", "Pooja", "Suresh", "Meera", "Karan", "Divya", "Manish", "Sneha", "Ravi", "Isha"];
const LAST = ["Kumar", "Singh", "Khan", "Sharma", "Verma", "Gupta", "Patel", "Reddy", "Nair", "Iyer"];
const SITES = ["Gurugram", "Noida", "Faridabad", "Dwarka", "Saket", "Sohna", "Manesar", "Greater Noida", "Rohini", "Vasant Kunj"];
const VERBS = ["Install", "Inspect", "Procure", "Test", "Commission", "Survey", "Repair", "Paint", "Excavate", "Certify"];
const NOUNS = ["electrical panel", "pump room", "filtration plant", "pool tiles", "sauna heater", "fire hydrant line", "DG set", "cable trays", "lighting circuit", "waterproofing"];
const pick = <T,>(a: T[], i: number) => a[i % a.length]!;

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await syncRbac(db);
  const org = (await db.organization.findFirst()) ?? (await db.organization.create({ data: { name: "Watcon" } }));
  const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id]));
  const superAdmin = await db.user.findFirst({ where: { role: { key: "SUPER_ADMIN" } } });
  if (!superAdmin) throw new Error("Run npm run bootstrap:admin first.");
  const counter = async (scope: "PROJECT" | "TASK" | "DEPARTMENT" | "EMPLOYEE", n: number) => {
    const c = await db.codeCounter.upsert({ where: { organizationId_scope: { organizationId: org.id, scope } }, create: { organizationId: org.id, scope, value: n }, update: { value: { increment: n } } });
    return c.value - n + 1;
  };

  const passwordHash = await hashPassword(password!);
  let d0 = await counter("DEPARTMENT", DEPTS.length);
  const depts: { id: string; name: string }[] = [];
  for (const name of DEPTS) {
    depts.push(await db.department.upsert({ where: { organizationId_name: { organizationId: org.id, name } }, create: { organizationId: org.id, name, code: formatCode("DEPARTMENT", d0++) }, update: {} }));
  }
  let e0 = await counter("EMPLOYEE", 40);
  const people: { id: string; fullName: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const fullName = `${pick(FIRST, i)} ${pick(LAST, i * 7 + 3)}`;
    const username = `demo.${fullName.toLowerCase().replace(/\s+/g, ".")}.${i}`;
    const dept = pick(depts, i);
    people.push(
      await db.user.upsert({
        where: { username },
        create: {
          organizationId: org.id, employeeCode: formatCode("EMPLOYEE", e0++), username, email: `${username}@demo.local`, fullName, passwordHash,
          roleId: i < 4 ? roles.ADMIN! : roles.USER!, designation: i < 4 ? "Project Manager" : "Site Engineer", whatsappNumber: `98${String(10000000 + i * 7919).slice(0, 8)}`,
          primaryDepartmentId: dept.id, departmentMembership: { create: [{ departmentId: dept.id }, ...(i % 3 === 0 ? [{ departmentId: pick(depts, i + 1).id }] : [])] },
        },
        update: {},
      }),
    );
  }
  let p0 = await counter("PROJECT", 25);
  const projects: { id: string }[] = [];
  for (let i = 0; i < 25; i++) {
    projects.push(
      await db.project.create({
        data: {
          organizationId: org.id, code: formatCode("PROJECT", p0++), name: `${pick(SITES, i)} Site ${String.fromCharCode(65 + (i % 26))}`, siteAddress: `Plot ${i + 1}, ${pick(SITES, i)}`, description: "Demo project for load testing.",
          status: (["ACTIVE", "ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED"] as const)[i % 5], priority: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const)[i % 4], managerId: people[i % 4]!.id, createdById: superAdmin.id,
          startDate: new Date(Date.UTC(2026, i % 12, 1)), members: { create: [{ userId: people[i % 4]!.id }] },
        },
      }),
    );
  }
  let t0 = await counter("TASK", taskCount);
  const statuses = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
  for (let start = 0; start < taskCount; start += 500) {
    await db.$transaction(async (tx) => {
      for (let i = start; i < Math.min(taskCount, start + 500); i++) {
        const status = statuses[(i * 7) % 5]!;
        const a = people[(i * 3) % 40]!;
        const b = people[(i * 5 + 1) % 40]!;
        const assignees = a.id === b.id ? [a] : [a, b];
        const deps = [pick(depts, i), pick(depts, i + 3)];
        const due = new Date(Date.UTC(2026, 9 + (i % 5), 1 + (i % 28)));
        await tx.task.create({
          data: {
            organizationId: org.id, code: formatCode("TASK", t0++), title: `${pick(VERBS, i)} ${pick(NOUNS, i * 3)} #${i + 1}`, projectId: pick(projects, i).id, createdById: superAdmin.id,
            status, progress: status === "COMPLETED" ? 100 : status === "TODO" ? 0 : (i * 13) % 95, completedAt: status === "COMPLETED" ? new Date() : null,
            priority: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const)[i % 4], dueDate: due, ownerId: a.id,
            departmentSortKey: deps.map((d) => d.name.toLowerCase()).sort()[0], assigneeSortKey: assignees.map((p) => p.fullName.toLowerCase()).sort()[0],
            departments: { create: [...new Set(deps.map((d) => d.id))].map((departmentId) => ({ departmentId })) },
            assignees: { create: assignees.map((p) => ({ userId: p.id })) },
          },
        });
      }
    }, { timeout: 120_000 });
    console.log(`  ${Math.min(taskCount, start + 500)} / ${taskCount} tasks`);
  }
  console.log("Demo data created.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
