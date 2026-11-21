# ERP implementation progress (durable log)

_Last updated: 2026-11-20. Rate-enquiry UI increment added; remaining work is listed below._

## Safety rules for every session

* `.env` `DATABASE_URL` points at **production Supabase**. Never run Prisma CLI without overriding it:
  `LOCALDB=postgresql://watcon:watcon_local_dev@localhost:5433/watcon_dev; DATABASE_URL=$LOCALDB DIRECT_URL=$LOCALDB npx prisma …`
* Start the local DB: `npm run db:start` (keep running). Tests: `env -u DIRECT_URL npx vitest run`.
* New migrations: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` against the
  **local dev DB**, hand-edit (back-fills, CHECKs), apply locally with `migrate deploy`. Keep hand-written partial /
  expression indexes (`parties_org_gstin_key`, `parties_org_lower_name_key`, `supplier_bills_unique_invoice`).
* After adding routes run `npx next typegen` before `tsc`. Page files must not export extra constants.
* Zod 4: use `z.union([...]).optional()`, never a union containing `z.undefined()` (key would stay required).
* Nothing is committed or deployed. Production migration needs explicit approval.

## State at pause

Last verified: `tsc --noEmit` clean. Tests last run: unit 60/60, foundation 16/16, procurement-stores 13/13,
original suite 98/98 (full suite not re-run after the latest UI files — run it first next session).

| Phase | Status |
|---|---|
| A Audit | ✅ `docs/erp/00_AUDIT_AND_GAP_ANALYSIS.md` |
| B Foundation | ✅ migration `20261120090000_erp_b_foundation`; money, FY numbering, 6 new roles + permissions, parties, locations, location-aware engine, reservations, consumption, reversals, attachments (DB storage), Settings → Commercial |
| Schema C–H | ✅ migration `20261120120000_erp_documents` (all document tables + CHECK guards), applied locally, zero drift |
| C Material planning | ✅ service + `/material-planning` UI (bulk PR from shortages, reserve, transfer/RFQ/PO links) |
| D Procurement services | ✅ PR, RFQ/quotations/comparison/award, PO (approval, SoD, limits, amend, cancel, short-close) — tested |
| D Procurement UI | PO and PR pages; RFQ list, creation, detail, quotation entry, comparison and award added. Browser verification, quotation-specific attachments and acceptable-brand entry remain. |
| E Stores services | ✅ GRN (create/submit/post/reject/reverse, idempotent, concurrency-safe), challans (dispatch → transit → GRN receipt, discrepancy close, client delivery / supplier return) — tested |
| E Stores UI | **TODO**: `/site-receipts` (pending-deliveries inbox, mobile GRN form with camera via AttachmentsPanel), `/site-receipts/[id]`, `/challans`, `/challans/new` (prefill `?type&projectId&itemBrandId&qty`), `/challans/[id]`. Actions exist in `src/modules/stores/actions.ts` |
| F Supplier bills / payments / notes | TODO (schema exists: supplier_bills, payments, payment_allocations, adjustment_notes). Rules: 2/3-way match vs `po_lines.billed_qty` / `grn_lines.billed_qty`, duplicate invoice index, TDS, allocations with row locks, advances = unallocated payment |
| G Client POs / Sales orders | TODO (schema exists) |
| H RA bills / client invoices / receipts | TODO (schema exists) |
| I Accounts, project command center, reports | TODO |
| J Project workspace tabs, approvals inbox, documents page, E2E, final docs | TODO. Sidebar already links to all modules — pages for unbuilt modules will 404 until built |

## Key files

* Stock engine: `src/modules/inventory/engine.ts` (only code that changes balances)
* Commercial core (scoping, approvals/SoD, guarded transitions): `src/modules/commercial/core.ts`; pricing: `commercial/pricing.ts`
* Money: `src/lib/money.ts` · Numbering: `src/lib/doc-numbering.ts` · GST: `src/lib/gst.ts`
* Attachments: `src/modules/documents/*`, `src/app/api/attachments/*`, `src/components/documents/*`
* Access registry (attachments/activity): `src/modules/documents/access.ts` — add a resolver per new document type
* PDF builders: `src/modules/documents/pdf-models.ts` — add a builder per new document type
* Shared UI: `components/commercial/{ui,lines-editor,doc-actions,related-docs}.tsx`
* Tests: `tests/integration/{foundation,procurement-stores}.test.ts`, `tests/unit/commercial-foundation.test.ts`

## Continuation prompt

> Continue the WATCON-APP ERP build. Read `docs/erp/PROGRESS.md`. Start the local DB, run typegen, tsc and the full
> test suite to confirm green, then build the RFQ pages, then the Site Receipts / Challans UI, then Phase F.

## Latest continuation

* Local baseline: full Vitest suite passed 143/143 before this increment; after changes the procurement/stores integration suite passed 14/14, including concurrent award conversion and invalid RFQ references. `next typegen` and `tsc --noEmit` passed. ESLint reported no errors and three existing PO warnings.
* RFQ creation validates the location, requisition, item-brand and requisition-line relationships. Award-to-PO conversion now locks the RFQ and creates all supplier POs in one transaction.
* RFQ UI has not been exercised in a browser. It does not yet expose acceptable alternatives or quotation-specific evidence; general RFQ attachments are available. Do not treat the broader ERP as complete or production-ready.
* Next: browser/E2E verification and complete RFQ gaps, then Site Receipts / Challans UI and the remaining phases. Do not deploy or run migrations against production.

## Stores / procurement UI audit (2026-11-21)

* Verified present: `/site-receipts` (pending-deliveries inbox), `/site-receipts/new|[id]|[id]/edit` (AttachmentsPanel with camera), `/challans`, `/challans/new` (prefill `type/projectId/itemBrandId/qty/soId`, CLIENT_DELIVERY picks approved project SOs), `/challans/[id]`; material planning shows source SO; PR/RFQ/PO details use `ProjectTrace`; RFQ acceptable brands and per-quotation attachments exist (earlier "gaps" are closed).
* Added: `docCrumbs` now delegates to `projectCrumbs`; `listCrumbs` / `lockedProject` in `components/procurement/crumbs.ts`. With `?projectId=` the PR/RFQ/PO/site-receipt/challan/stock/material-planning lists show project breadcrumbs and hide the project filter.
* tsc clean, ESLint clean, procurement-stores 18/18. Not browser-verified. Note: integration tests share one DB; concurrent runs deadlock on schema drop.

## Session 2026-11-21 — all module UIs built, verified

* Built/finished: sales orders (+ amendment requests, diff preview, revision history, fulfilment), client POs, running
  bills, client invoices, project hub (23 tabs, order-flow guide, switcher), approvals (Super Admin amendment section),
  supplier bills / payments / notes polish, stores & procurement breadcrumbs + project locking.
* Verified: `tsc` clean, `eslint src tests` 0 errors, **full Vitest 178/178**, `next build` OK.
* Browser smoke test (production build, isolated local DB `watcon_e2e`): all 42 module pages and all 23 project tabs
  return 200; client → project → SO draft → submit → SoD blocks self-approval → Admin approves → SO locked, `/edit`
  redirects → Admin raises amendment (diff 10→12) → requester sees "Waiting for Super Admin" → Super Admin approves →
  Rev 1, ₹11,800→₹14,160, history + audit correct. SO PDF renders.
* Fixed during smoke test: revision-history empty text while a request is pending; approvals stats ignored amendments.
* Not browser-tested yet: material-item SO → material requirements → PR → RFQ → PO → GRN → challan → invoice → payment
  (covered by integration tests only). Mobile layout not checked.
* Test runs: use PowerShell (Git Bash fails with "Vitest failed to find the runner"). In PowerShell, set
  `$env:DB_SSL_CA=' '` (an empty string unsets the var and `.env`'s CA is used).
* `next.config.ts` uses `output: "standalone"` — run production with `node .next/standalone/server.js`, not `next start`.
* Production (Supabase), 2026-11-21, approved by owner: `erp_b_foundation` + `erp_documents` were already applied on
  2026-11-20 (checksums match). Applied `20261121090000_so_amendments` with `prisma migrate deploy`; ran `npm run db:seed`
  (RBAC sync → 9 roles, 70 permissions). `migrate diff` vs schema is empty. Data unchanged (86 projects, 353 items, 4 users).
  Pre-migration JSON backup of all 69 tables: `C:/Users/Admin/Desktop/Sana/watcon-supabase-backup-2026-11-21/`.
  The deployed app code is NOT updated yet — nothing committed/pushed.

## Session 2026-11-21 (evening) — owner decisions applied

* Contract value = active client POs + approved sales orders not linked to a client PO (no double counting).
* Material cost / margin = cost of material delivered to the client or consumed at site (net of reversals), valued at
  the project's weighted-average receipt cost (org-wide average as fallback). Stock still at site is not a cost.
* Client invoices: cannot be created without a place of supply (client state); the person who drafted an invoice cannot
  issue it (standard separation of duties via `assertCanApprove`, docType `INVOICE`).
* Small fixes: SO line text no longer duplicated; SO and PR "Related documents" list the PR → RFQ → PO → receipt chain
  (`procurementForSalesOrder` / `procurementForRequisition` in `procurement/trace.ts`, filtered by view permission);
  GRN header shows its sales order; site-receipts header button reads "Send material (challan)"; receipt form warns
  when nothing more is expected; "View stock" after posting opens filtered to the location; challan SO picker lists
  only orders with material left to deliver; project overview shortage count matches planning.
* Verified: tsc, eslint, full Vitest 180/180, `next build`.
