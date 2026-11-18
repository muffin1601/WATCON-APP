import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by the Prisma CLI only (migrate / status). Prefers DIRECT_URL so migrations can
    // bypass a transaction-mode pooler (Supabase :6543); falls back to DATABASE_URL.
    // The running app always uses DATABASE_URL (src/lib/db). Read lazily so
    // `prisma generate` works without a database configured.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
