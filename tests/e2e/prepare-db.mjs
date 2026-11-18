/**
 * Prepares the disposable E2E database: drops and recreates the schema, applies all
 * migrations, syncs roles/permissions and bootstraps the E2E Super Admin through the
 * real bootstrap command. Refuses to run against any database not ending in "_e2e".
 */
import { execSync } from "node:child_process";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const dbName = new URL(url).pathname.slice(1);
if (!dbName.endsWith("_e2e")) throw new Error(`Refusing to reset non-E2E database "${dbName}"`);

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
await client.end();

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });
run("npx prisma migrate deploy");
run("npx tsx scripts/bootstrap-admin.ts");
console.log("E2E database ready.");
