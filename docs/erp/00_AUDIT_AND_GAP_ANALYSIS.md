# Phase A — Codebase audit & gap analysis (ERP commercial modules)

_Audit date: 2026-11-20 · Baseline commit `809536c` · Audited against local PostgreSQL 17 (`:5433`)._

## 1. Baseline quality gates (before any change)

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `eslint src tests scripts` | 0 errors, 1 pre-existing warning (`members/service.ts:338` unused var) |
| Vitest unit + integration (real Postgres) | 98 / 98 passed |

## 2. What exists today

| Area | State | Notes |
|---|---|---|
| Auth (DB sessions, Argon2id, reset links, rate limits) | **Working** | `src/lib/auth`, `src/modules/auth` |
| RBAC | **Working, limited** | Only 3 fixed roles (`SUPER_ADMIN`, `ADMIN`, `USER`) in a Postgres enum; permission catalogue in `src/lib/permissions/definitions.ts`; scopes in `scopes.ts` |
| Projects / departments / members / tasks | **Working** | Phase 1, fully tested |
| Reports (print / PDF / WhatsApp link) | **Working** (tasks only) | `@react-pdf/renderer`, Helvetica only |
| Items, brands, item–brand links | **Working** | Case-insensitive brand duplicate check in service (no DB index) |
| Stock ledger | **Working, single location** | `item_brands.current_qty` + append-only `stock_transactions`; idempotency key; conditional update prevents negative stock; `source_type/source_id` reserved for documents |
| Audit log | **Working** | `audit_logs` (no project link) |
| Business codes | **Working** | `code_counters` (enum scope, no financial-year reset) |

## 3. What does NOT exist (the brief assumed some of these did)

There are **no** existing Sales Orders, Purchase Orders, client POs, rate enquiries, challans,
running bills, accounts, suppliers, clients, file uploads or approval workflows in the code or
database. Every commercial module is therefore new work, not a repair.

| Feature | State |
|---|---|
| Suppliers / clients (parties, GSTIN, state code) | Missing |
| Stock locations (warehouse / site / in-transit) | Missing — all stock is implicitly one store |
| Reservations, MRP, reorder levels | Missing |
| Purchase requisitions, RFQ, supplier quotations, comparison | Missing |
| Purchase orders, approvals, amendments | Missing |
| Challans, transfers, GRN / site receipts | Missing |
| Supplier bills, 2/3-way match, payments, advances, notes | Missing |
| Client POs, Sales Orders, RA bills, client invoices, receipts | Missing |
| Attachments / evidence storage | Missing (only the org logo, as a data URL) |
| GST / HSN / financial-year numbering | Missing |
| Project accounts, aging, commercial reports | Missing |

## 4. Broken integrations / inconsistencies found

1. **Sidebar** shows a disabled "Suppliers — Soon" entry; no module behind it.
2. **`Permissions-Policy: geolocation=()`** (in `next.config.ts`) would block optional GPS capture on site receipts.
3. Brand-name uniqueness is case-insensitive only in the service; the DB unique index is case-sensitive (race window). Left as is — adding a `lower(name)` index could fail on existing production data; flagged.
4. Role model is an enum of three roles, so the requested Project Manager / Site Engineer / Purchase / Storekeeper / Accounts / Viewer roles need new enum values and generalised role UI.

## 5. Security & financial risks to design for

| Risk | Mitigation adopted |
|---|---|
| `.env` `DATABASE_URL` points at the **production Supabase** pooler | Never run Prisma CLI with the default env; migrations and tests pin `DATABASE_URL`/`DIRECT_URL` to the local `_dev`/`_test` databases |
| Vercel has no persistent disk; 4.5 MB request limit | Attachment storage abstraction with a **database driver** by default (bytea), 4 MB default limit, filesystem driver optional, Firebase driver later |
| Float money arithmetic | BigInt fixed-point library (`src/lib/money.ts`), Postgres `NUMERIC` columns |
| Double stock posting (challan + GRN, bill + GRN) | Only GRN/transfer receipt posts stock; bills never touch stock; per-line idempotency keys `doc:<id>:<line>` |
| Concurrent receipts of the same PO | Conditional `UPDATE … WHERE received + x <= ordered` inside the posting transaction |
| Self-approval | Separation-of-duties check (creator/submitter ≠ approver) + per-role approval limits |
| Over-allocation of payments / overbilling | Row locks (`SELECT … FOR UPDATE`) + cumulative checks inside the transaction |
| Unauthorized document/file access | Every query AND-ed with project scope; files served only through an authorised route handler with `nosniff` + `attachment` disposition |

## 6. Database changes required (additive only)

Per phase, each its own migration; no existing table, column or row is dropped.

* **B** org commercial settings, document series/counters (FY based), parties, stock locations,
  location balances (back-filled from `item_brands.current_qty` into a default *Central Warehouse*),
  `location_id` on `stock_transactions` (back-filled), new stock movement types, reservations,
  attachments + blobs, `project_id` on `audit_logs`, new roles, item HSN/GST, reorder level.
* **C** material requirements.
* **D** purchase requisitions, RFQs, supplier quotations, purchase orders, PO revisions.
* **E** challans (transfers), GRNs.
* **F** supplier bills, payments, allocations, credit/debit notes.
* **G** client POs (+ revisions, milestones), sales orders.
* **H** RA bills, client invoices.

## 7. Decisions

* **Client PO vs Sales Order.** Client PO = the *contract* (authority & ceiling for quantities and
  value; RA bills certify against it). Sales Order = an internal *execution/supply order* for
  deliverable goods drawn down from a client PO (drives client delivery challans and supply invoices).
  An SO line cannot exceed the uncommitted quantity of its client-PO line.
* **Accounts.** The app does not contain a double-entry general ledger. Phase I delivers an
  **operational accounts sub-ledger** (receivables, payables, advances, allocations, aging) and
  is labelled as such — not as complete accounting.
* **Stock posting events.** GRN *posting* (after verification) and transfer *dispatch/receipt*
  are the only stock-changing documents besides manual movements / adjustments / consumption.
