/**
 * Production-safe seed: syncs roles and permissions only. Creates NO users and NO
 * business data. Run with `npm run db:seed` (also invoked by `prisma migrate reset`).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgAdapterConfig } from "../src/lib/db/adapter-config";
import { syncRbac } from "../src/modules/auth/rbac-sync";

async function main() {
  const client = new PrismaClient({ adapter: new PrismaPg(pgAdapterConfig(process.env.DATABASE_URL!)) });
  try {
    await syncRbac(client);
    console.log("Roles and permissions are in sync.");
  } finally {
    await client.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
