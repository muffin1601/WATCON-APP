import { execSync } from "node:child_process";
import pg from "pg";

/**
 * Recreates the dedicated integration-test database schema and applies all
 * migrations. Refuses to touch any database whose name does not end in "_test".
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://watcon:watcon_local_dev@localhost:5433/watcon_test";
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to reset non-test database "${dbName}"`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();

  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
