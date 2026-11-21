# ERP feature checklist (sales-order-driven, project-centred)

Legend: [x] built, [~] built, not browser-verified, [ ] not built / owned by another work stream.

## Operating rules

1. Everything lives under a **project**. Every document carries `projectId`; list pages accept `?projectId=` and the
   "New ..." forms pre-fill it.
2. The project's **Sales Order drives the flow**: SO -> Material planning -> Requisitions -> RFQ / PO -> Site receipts
   (GRN) -> Client challans -> Invoices & receipts. A project with no SO shows "Create sales order" as its primary action.
3. **Approved sales orders are locked.** A change is made through a *sales-order amendment request*: the requester
   states a reason and the proposed header + lines, and only a **Super Admin** can approve it. The Super Admin cannot
   decide their own request. Approval applies the change as a new revision of the SO; rejection leaves the SO unchanged.
   Requesters see their requests as "Waiting for Super Admin".
4. All stock movement goes through `src/modules/inventory/engine.ts`. Approvals respect separation of duties and limits.

## Project hub (`/projects/[id]?tab=...`)

- [~] Overview: Order flow guide with counts and next-action buttons; "Create sales order" banner and header CTA when no SO
- [~] Overview: needs-attention list, money position (client / supplier side, margin), material status, task progress, status updates
- [~] Tabs grouped Sales / Materials / Site & stores / Accounts / Records, each with count + pending badge
- [~] Sales tabs: Sales orders (with pending amendment requests), Client POs, Running bills, Invoices, Receipts
- [~] Materials tabs: Material planning, Requisitions, Rate enquiries, Purchase orders
- [~] Site tabs: Site receipts, Challans, Site stock (balances, reservations, consumption)
- [~] Accounts tabs: Project accounts, Supplier bills, Payments, Credit / debit notes
- [~] Records tabs: Tasks, Documents, Activity, Status history, Team
- [~] Every list tab: search, status filter, pagination, row click opens the record, "New ..." links with `?projectId=`
- [~] Header project switcher keeps the current tab; breadcrumbs `Projects > code > tab`
- [x] Sidebar lists Projects first

## Approvals (`/approvals`)

- [x] Cross-module inbox (PR, RFQ award, PO, GRN, supplier bill, client PO, SO, running bill) grouped by project, SoD + limit aware
- [~] "Sales order amendment requests": Super Admin sees all pending except their own as actionable; requesters see theirs as waiting; links to `/sales-orders/[soId]`

## Modules

| Module | Status |
|---|---|
| Foundation (money, numbering, parties, locations, roles) | [x] |
| Material planning, requisitions, RFQ, PO | [x] services, [~] UI |
| Site receipts (GRN) and challans | [x] services; UI per PROGRESS.md |
| Supplier bills, payments, notes | schema + insights; check PROGRESS.md |
| Sales orders, client POs, running bills, invoices, receipts | owned by the sales work stream (not part of this increment) |
| Accounts, reports, documents | [~] |

Remaining everywhere: browser / E2E verification, production migration (needs explicit approval).
