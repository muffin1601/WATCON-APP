/**
 * One-time bootstrap of the organization and the first Super Admin.
 *
 *   npm run bootstrap:admin
 *
 * Reads BOOTSTRAP_* variables from the environment (never hardcoded). Refuses to run
 * if any Super Admin already exists, so it cannot be used to create a second one or
 * to take over an installation. Runs inside a SERIALIZABLE transaction so two
 * concurrent invocations cannot both succeed.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgAdapterConfig } from "../src/lib/db/adapter-config";
import { syncRbac } from "../src/modules/auth/rbac-sync";
import { hashPassword, passwordPolicy } from "../src/lib/auth/password";
import { formatCode } from "../src/lib/codes";

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const orgName = process.env.BOOTSTRAP_ORG_NAME?.trim() || "Company";

  if (!name || !email || !username || !password) {
    throw new Error("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL is not a valid email.");
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("BOOTSTRAP_ADMIN_USERNAME must be 3-40 chars: a-z 0-9 . _ -");
  const pw = passwordPolicy.safeParse(password);
  if (!pw.success) throw new Error(`BOOTSTRAP_ADMIN_PASSWORD: ${pw.error.issues[0]?.message}`);

  const client = new PrismaClient({ adapter: new PrismaPg(pgAdapterConfig(process.env.DATABASE_URL!)) });
  try {
    await syncRbac(client);
    const passwordHash = await hashPassword(password);
    const result = await client.$transaction(
      async (tx) => {
        const existing = await tx.user.count({ where: { role: { key: "SUPER_ADMIN" } } });
        if (existing > 0) return "exists" as const;
        const role = await tx.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
        const org = (await tx.organization.findFirst()) ?? (await tx.organization.create({ data: { name: orgName } }));
        const counter = await tx.codeCounter.upsert({
          where: { organizationId_scope: { organizationId: org.id, scope: "EMPLOYEE" } },
          create: { organizationId: org.id, scope: "EMPLOYEE", value: 1 },
          update: { value: { increment: 1 } },
        });
        const user = await tx.user.create({
          data: {
            organizationId: org.id,
            employeeCode: formatCode("EMPLOYEE", counter.value),
            username,
            email,
            fullName: name,
            passwordHash,
            roleId: role.id,
            passwordChangedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: { organizationId: org.id, actorId: user.id, action: "auth.bootstrap_super_admin", entityType: "user", entityId: user.id, summary: "Initial Super Admin created by bootstrap command" },
        });
        return "created" as const;
      },
      { isolationLevel: "Serializable" },
    );
    if (result === "exists") {
      console.error("A Super Admin already exists. Bootstrap refused (no changes made).");
      process.exitCode = 1;
    } else {
      console.log(`Super Admin created: ${email} (username: ${username}). Remove BOOTSTRAP_ADMIN_PASSWORD from the environment now.`);
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
