/**
 * One-off, idempotent import of public/assets/products.json into items + item_images.
 * Local dev DB by default; pass --production to target DIRECT_URL from .env. Re-running updates in place.
 *   node scripts/import-products.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const production = process.argv.includes("--production");
let client;
if (production) {
  // Explicit opt-in only. Uses the verified-TLS settings the app itself uses.
  process.loadEnvFile?.(".env");
  const ca = process.env.DB_SSL_CA?.replace(/\n/g, String.fromCharCode(10)).trim();
  const u = new URL(process.env.DIRECT_URL);
  u.searchParams.delete("sslmode");
  client = new pg.Client({ connectionString: u.toString(), ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) });
} else {
  const url = "postgresql://watcon:watcon_local_dev@localhost:5433/watcon_dev";
  client = new pg.Client({ connectionString: url });
}

const root = path.resolve("public/assets");
const products = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const dirs = Object.fromEntries(fs.readdirSync(path.join(root, "images")).map((d) => [d.split("-")[0], d]));
const title = (s) => s.split("-").map((w) => w.toUpperCase() === w ? w : w[0].toUpperCase() + w.slice(1)).join(" ");

await client.connect();
try {
  const orgs = (await client.query("select id from organizations")).rows;
  if (orgs.length !== 1) throw new Error(`Expected exactly 1 organization, found ${orgs.length}`);
  const orgId = orgs[0].id;
  const admin = (await client.query("select id from users where organization_id=$1 order by created_at limit 1", [orgId])).rows[0];
  await client.query("begin");
  let items = 0, images = 0;
  for (const p of products) {
    const code = `PRD-${String(p.id).padStart(4, "0")}`;
    const sub = p.subcategory && p.subcategory !== "null" ? title(p.subcategory) : null;
    const feats = (p.data?.features ?? []).filter(Boolean);
    const description = [sub ? `Series: ${sub}` : null, p.description?.trim(), feats.length ? "Features:\n" + feats.map((f) => `• ${f}`).join("\n") : null].filter(Boolean).join("\n\n") || null;
    const r = await client.query(
      `insert into items (id, organization_id, code, name, category, unit, description, status, created_by_id, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, $3, $4, 'Nos', $5, 'ACTIVE', $6, now(), now())
       on conflict (organization_id, code) do update set name=excluded.name, category=excluded.category, description=excluded.description, updated_at=now()
       returning id`,
      [orgId, code, p.name.trim(), title(p.category), description, admin?.id ?? null],
    );
    items++;
    const dir = dirs[String(p.id)];
    if (!dir) continue;
    const files = fs.readdirSync(path.join(root, "images", dir)).sort((a, b) => parseInt(a) - parseInt(b));
    for (const [i, f] of files.entries()) {
      await client.query(
        `insert into item_images (id, item_id, path, sort_order) values (gen_random_uuid(), $1, $2, $3)
         on conflict (item_id, path) do update set sort_order=excluded.sort_order`,
        [r.rows[0].id, `/assets/images/${dir}/${f}`, i],
      );
      images++;
    }
  }
  await client.query("commit");
  console.log({ items, images });
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  await client.end();
}
