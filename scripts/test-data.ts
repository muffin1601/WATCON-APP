/**
 * Removable test data for trying the ERP on a real database.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-data.ts seed
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-data.ts cleanup            (dry run: lists what would go)
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-data.ts cleanup --yes      (deletes it)
 *
 * Everything this script creates is named with the "[TEST]" prefix: two clients, one
 * supplier, one project and a draft sales order. You can then run the whole flow on that
 * project in the app (approve, plan, buy, receive, deliver, invoice, receive payment).
 *
 * `cleanup` removes the [TEST] project and parties and EVERY row that points at them,
 * found by following foreign keys (documents, lines, stock movements, audit entries …),
 * then recomputes the affected stock balances and resets document / code counters to the
 * highest number still in use, so real numbering continues without a gap.
 * It refuses to run if a non-[TEST] party has documents in the [TEST] project, or a
 * non-[TEST] project has documents for a [TEST] party (that would be real data).
 *
 * The `react-server` condition makes the `server-only` guard a no-op so the app's own
 * services (validation, numbering, totals, audit) are used to create the data.
 */
import "dotenv/config";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions/definitions";
import { createParty } from "@/modules/parties/service";
import { createProject } from "@/modules/projects/service";
import { createSalesOrder } from "@/modules/sales/sales-order";

const TAG = "[TEST]";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

async function actorFor(username: string): Promise<Actor & { fullName: string }> {
  const u = await db.user.findUniqueOrThrow({ where: { username }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
  return { id: u.id, organizationId: u.organizationId, role: u.role.key, permissions: u.role.permissions.map((p) => p.permission.key), fullName: u.fullName };
}

async function superAdminActor() {
  const u = await db.user.findFirstOrThrow({ where: { role: { key: "SUPER_ADMIN" }, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  return actorFor(u.username);
}

function today(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────── seed ───────────────────────────

async function seed() {
  const existing = await db.project.findFirst({ where: { name: { startsWith: TAG } } });
  if (existing) throw new Error(`Test data already exists (${existing.code} ${existing.name}). Run cleanup first.`);
  const actor = await superAdminActor();
  const admin = await db.user.findFirst({ where: { role: { key: "ADMIN" }, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });

  const alpha = await createParty(actor, { name: `${TAG} Alpha Pools Pvt Ltd`, isClient: true, stateCode: "06", city: "Gurugram", contactPerson: "Test Contact", paymentTermsDays: 30, notes: "Test client — delete with scripts/test-data.ts cleanup" });
  const beta = await createParty(actor, { name: `${TAG} Beta Builders`, isClient: true, stateCode: "29", city: "Bengaluru", paymentTermsDays: 45, notes: "Test client (Karnataka, for IGST) — delete with cleanup" });
  const supplier = await createParty(actor, { name: `${TAG} Pipe Traders`, isSupplier: true, stateCode: "06", city: "Faridabad", paymentTermsDays: 30, notes: "Test supplier — delete with cleanup" });

  const project = await createProject(actor, {
    name: `${TAG} Demo Pool Site`,
    siteAddress: "Test address — not a real site",
    description: "Test project for trying the sales-order flow. Delete with scripts/test-data.ts cleanup.",
    priority: "MEDIUM",
    status: "PLANNING",
    startDate: today(),
    managerId: admin?.id ?? null,
    memberIds: [],
  });

  const material = await db.itemBrand.findFirst({ where: { item: { organizationId: actor.organizationId } }, orderBy: { createdAt: "asc" }, include: { item: true, brand: true } });
  const so = await createSalesOrder(actor, {
    projectId: project.id,
    partyId: alpha.id,
    orderDate: today(),
    deliveryDate: today(21),
    deliveryAddress: "Test address — not a real site",
    paymentTerms: "30 days from invoice (test)",
    notes: "Test sales order — delete with cleanup",
    lines: [
      ...(material ? [{ itemBrandId: material.id, quantity: "4", rate: "25000", gstRate: "18", unit: material.item.unit }] : []),
      { description: "Installation & commissioning (test service line)", unit: "LS", quantity: "1", rate: "40000", gstRate: "18" },
    ],
  });

  const p = await db.project.findUniqueOrThrow({ where: { id: project.id } });
  const s = await db.salesOrder.findUniqueOrThrow({ where: { id: so.id } });
  console.log("Created:");
  console.log(`  Clients:   ${alpha.name} (Haryana), ${beta.name} (Karnataka)`);
  console.log(`  Supplier:  ${supplier.name}`);
  console.log(`  Project:   ${p.code} ${p.name}${admin ? ` (manager: ${admin.fullName})` : ""}`);
  console.log(`  Sales order (draft): ${s.number} – ₹${s.total.toFixed(2)}${material ? ` · material line ${material.item.name} – ${material.brand.name}` : ""}`);
}

// ─────────────────────────── cleanup ───────────────────────────

type Fk = { child: string; childCol: string; parent: string; parentCol: string };

async function foreignKeys(): Promise<Fk[]> {
  return db.$queryRaw<Fk[]>`
    SELECT kcu.table_name AS child, kcu.column_name AS "childCol", ccu.table_name AS parent, ccu.column_name AS "parentCol"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`;
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/** Every row (by table → ids) that transitively points at the root rows through foreign keys. */
async function closure(roots: Record<string, string[]>) {
  const fks = await foreignKeys();
  const found = new Map<string, Set<string>>();
  const queue: [string, string[]][] = [];
  const add = (table: string, ids: string[]) => {
    const set = found.get(table) ?? new Set<string>();
    const fresh = ids.filter((id) => !set.has(id));
    fresh.forEach((id) => set.add(id));
    found.set(table, set);
    if (fresh.length) queue.push([table, fresh]);
  };
  for (const [t, ids] of Object.entries(roots)) add(t, ids);
  while (queue.length) {
    const [table, ids] = queue.shift()!;
    for (const fk of fks.filter((f) => f.parent === table && f.parentCol === "id")) {
      // Tables without an `id` column (join tables) are removed by cascade or explicitly below.
      const hasId = (await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'`, fk.child))[0]!.n > 0;
      if (!hasId) continue;
      const rows = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT id::text AS id FROM ${q(fk.child)} WHERE ${q(fk.childCol)} = ANY($1::uuid[])`, ids);
      if (rows.length) add(fk.child, rows.map((r) => r.id));
    }
  }
  return { found, fks };
}

async function cleanup(execute: boolean) {
  const actor = await superAdminActor();
  const org = actor.organizationId;
  const projects = await db.project.findMany({ where: { organizationId: org, name: { startsWith: TAG } }, select: { id: true, code: true, name: true } });
  const parties = await db.party.findMany({ where: { organizationId: org, name: { startsWith: TAG } }, select: { id: true, code: true, name: true } });
  if (!projects.length && !parties.length) {
    console.log("No [TEST] data found. Nothing to do.");
    return;
  }
  const projectIds = projects.map((p) => p.id);
  const partyIds = parties.map((p) => p.id);

  // Safety: refuse if real (non-test) parties / projects are mixed with test ones.
  const partyTables = ["sales_orders", "client_pos", "client_invoices", "ra_bills", "purchase_orders", "supplier_bills", "payments", "grns", "challans", "adjustment_notes"];
  for (const t of partyTables) {
    const mixed = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM ${q(t)} WHERE (project_id = ANY($1::uuid[]) AND party_id IS NOT NULL AND NOT (party_id = ANY($2::uuid[])))
                                              OR (party_id = ANY($2::uuid[]) AND project_id IS NOT NULL AND NOT (project_id = ANY($1::uuid[])))`,
      projectIds,
      partyIds,
    );
    if (mixed[0]!.n > 0) throw new Error(`Refusing: ${t} has ${mixed[0]!.n} row(s) mixing [TEST] and real projects/parties. Sort those out by hand first.`);
  }

  const locations = await db.stockLocation.findMany({ where: { organizationId: org, projectId: { in: projectIds } }, select: { id: true } });
  const { found } = await closure({ projects: projectIds, parties: partyIds, stock_locations: locations.map((l) => l.id) });

  // Stock touched by test movements, to recompute afterwards.
  const txnIds = [...(found.get("stock_transactions") ?? [])];
  const touched = txnIds.length
    ? await db.$queryRaw<{ location_id: string; item_brand_id: string }[]>`SELECT DISTINCT location_id::text, item_brand_id::text FROM stock_transactions WHERE id = ANY(${txnIds}::uuid[])`
    : [];
  const allIds = new Set([...found.values()].flatMap((s) => [...s]));
  const notifications = (await db.notification.findMany({ where: { link: { not: null } }, select: { id: true, link: true } })).filter((n) => (n.link!.match(UUID) ?? []).some((id) => allIds.has(id.toLowerCase())));
  // Audit entries and attachments refer to their document by entity_id without a foreign key
  // (e.g. "party created" has no project), so pick those up explicitly.
  for (const t of ["audit_logs", "attachments"]) {
    const rows = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT id::text AS id FROM ${q(t)} WHERE entity_id::text = ANY($1::text[])`, [...allIds]);
    const set = found.get(t) ?? new Set<string>();
    rows.forEach((r) => set.add(r.id));
    if (set.size) found.set(t, set);
  }

  console.log(`[TEST] projects: ${projects.map((p) => `${p.code} ${p.name}`).join(", ") || "—"}`);
  console.log(`[TEST] parties:  ${parties.map((p) => p.name).join(", ") || "—"}`);
  console.log("Rows to delete:");
  for (const [t, ids] of [...found.entries()].sort()) console.log(`  ${t.padEnd(28)} ${ids.size}`);
  console.log(`  ${"notifications".padEnd(28)} ${notifications.length}`);
  console.log(`Stock balances to recompute: ${touched.length} location × item–brand pair(s)`);
  if (!execute) {
    console.log("\nDry run only. Re-run with --yes to delete.");
    return;
  }

  console.log("\nDeleting… (any 'foreign key constraint' messages below are expected: rows are retried until their children are gone)");
  await db.$transaction(
    async (tx) => {
      // Delete in passes: a row whose children still exist fails under a savepoint and is retried.
      const pending = new Map([...found.entries()].map(([t, s]) => [t, new Set(s)]));
      for (let pass = 0; pass < 25 && [...pending.values()].some((s) => s.size); pass++) {
        for (const [t, set] of pending) {
          if (!set.size) continue;
          await tx.$executeRawUnsafe(`SAVEPOINT del`);
          try {
            await tx.$executeRawUnsafe(`DELETE FROM ${q(t)} WHERE id = ANY($1::uuid[])`, [...set]);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT del`);
            set.clear();
          } catch {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT del`);
          }
        }
      }
      const left = [...pending.entries()].filter(([, s]) => s.size);
      if (left.length) throw new Error(`Could not delete: ${left.map(([t, s]) => `${t} (${s.size})`).join(", ")}. Nothing was changed.`);
      if (notifications.length) await tx.notification.deleteMany({ where: { id: { in: notifications.map((n) => n.id) } } });

      // Recompute balances from the remaining ledger, then the company totals.
      for (const { location_id, item_brand_id } of touched) {
        await tx.$executeRaw`
          UPDATE stock_balances b SET on_hand = COALESCE((
            SELECT SUM(CASE WHEN t.direction = 'IN' THEN t.quantity ELSE -t.quantity END) FROM stock_transactions t
            WHERE t.location_id = b.location_id AND t.item_brand_id = b.item_brand_id), 0)
          WHERE b.location_id = ${location_id}::uuid AND b.item_brand_id = ${item_brand_id}::uuid`;
      }
      const ibs = [...new Set(touched.map((t) => t.item_brand_id))];
      if (ibs.length) {
        await tx.$executeRaw`
          UPDATE item_brands ib SET current_qty = COALESCE((SELECT SUM(b.on_hand) FROM stock_balances b WHERE b.item_brand_id = ib.id), 0)
          WHERE ib.id = ANY(${ibs}::uuid[])`;
      }

      // Document counters → highest number still in use (rows with nothing left are removed).
      const docTables: Record<string, { table: string; where?: string }> = {
        PR: { table: "purchase_requisitions" }, RFQ: { table: "rfqs" }, SQ: { table: "supplier_quotations" }, PO: { table: "purchase_orders" },
        GRN: { table: "grns" }, DC: { table: "challans" }, SB: { table: "supplier_bills" }, PAY: { table: "payments", where: "direction = 'OUT'" },
        RCPT: { table: "payments", where: "direction = 'IN'" }, CPO: { table: "client_pos" }, SO: { table: "sales_orders" }, RAB: { table: "ra_bills" },
        INV: { table: "client_invoices" }, CN: { table: "adjustment_notes", where: "note_type = 'CREDIT'" }, DN: { table: "adjustment_notes", where: "note_type = 'DEBIT'" }, SC: { table: "stock_counts" },
      };
      const counters = await tx.documentCounter.findMany({ where: { organizationId: org } });
      for (const c of counters) {
        const spec = docTables[c.docType];
        if (!spec) continue;
        const numbers = await tx.$queryRawUnsafe<{ number: string }[]>(`SELECT number FROM ${q(spec.table)} WHERE organization_id = $1::uuid${spec.where ? ` AND ${spec.where}` : ""}`, org);
        const inSeries = numbers.map((r) => r.number).filter((n) => !n.startsWith("DRAFT") && (c.fiscalYear === "ALL" || n.includes(c.fiscalYear)));
        const max = inSeries.reduce((m, n) => Math.max(m, Number(n.match(/(\d+)$/)?.[1] ?? 0)), 0);
        if (max === 0) await tx.documentCounter.delete({ where: { organizationId_docType_fiscalYear: { organizationId: org, docType: c.docType, fiscalYear: c.fiscalYear } } });
        else if (max < c.value) await tx.documentCounter.update({ where: { organizationId_docType_fiscalYear: { organizationId: org, docType: c.docType, fiscalYear: c.fiscalYear } }, data: { value: max } });
      }
      // Code counters (PRJ-0087, PTY-0001 …) → highest code still in use.
      const codeTables: Record<string, string> = { PROJECT: "projects", PARTY: "parties", TASK: "tasks", STOCK_TXN: "stock_transactions", LOCATION: "stock_locations" };
      for (const c of await tx.codeCounter.findMany({ where: { organizationId: org } })) {
        const table = codeTables[c.scope];
        if (!table) continue;
        const rows = await tx.$queryRawUnsafe<{ code: string }[]>(`SELECT code FROM ${q(table)} WHERE organization_id = $1::uuid`, org);
        const max = rows.reduce((m, r) => Math.max(m, Number(r.code.match(/(\d+)$/)?.[1] ?? 0)), 0);
        if (max < c.value) await tx.codeCounter.update({ where: { organizationId_scope: { organizationId: org, scope: c.scope } }, data: { value: max } });
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
  console.log("\nDeleted. Stock balances and numbering counters were recomputed.");
}

// ─────────────────────────── main ───────────────────────────

const [cmd, flag] = process.argv.slice(2);
(async () => {
  if (cmd === "seed") await seed();
  else if (cmd === "cleanup") await cleanup(flag === "--yes");
  else console.log("Usage: tsx scripts/test-data.ts seed | cleanup [--yes]");
})()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
