/**
 * Local development PostgreSQL server (no Docker required).
 *
 * Starts a real PostgreSQL 17 instance from the `embedded-postgres` package with
 * its data directory in `.pgdata/`, and ensures the dev / test / e2e databases exist.
 *
 * Usage:  npm run db:start      (keeps running until Ctrl+C)
 *
 * This is for LOCAL DEVELOPMENT AND TESTS ONLY. Production uses a managed
 * PostgreSQL server configured through DATABASE_URL (see docs/DEPLOYMENT.md).
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const user = process.env.DEV_DB_USER ?? "watcon";
const password = process.env.DEV_DB_PASSWORD ?? "watcon_local_dev";
const databaseDir = path.resolve(".pgdata");
const databases = ["watcon_dev", "watcon_test", "watcon_e2e"];

const server = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  // Force UTF-8: on Windows initdb otherwise inherits the WIN1252 code page, which
  // rejects non-Latin text (e.g. Hindi names, "→").
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (e) => console.error("[postgres]", String(e).trim()),
});

if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
  console.log("Initialising PostgreSQL data directory at", databaseDir);
  await server.initialise();
}
await server.start();

const client = new pg.Client({ host: "localhost", port, user, password, database: "postgres" });
await client.connect();
const { rows: enc } = await client.query("SELECT pg_encoding_to_char(encoding) AS e FROM pg_database WHERE datname = 'template1'");
if (enc[0]?.e !== "UTF8") {
  console.error(`PostgreSQL cluster encoding is ${enc[0]?.e}, expected UTF8. Delete .pgdata and restart to re-initialise.`);
  await client.end();
  await server.stop();
  process.exit(1);
}
for (const db of databases) {
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE "${db}"`);
    console.log("Created database", db);
  }
}
await client.end();

console.log(`PostgreSQL ready on localhost:${port} (databases: ${databases.join(", ")})`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("Stopping PostgreSQL…");
  await server.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Keep the process alive.
setInterval(() => {}, 1 << 30);
