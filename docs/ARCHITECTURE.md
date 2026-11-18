# Architecture — Watcon Enterprise (Phase 1)

## Stack (verified versions)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4.6 (App Router, Turbopack, React 19.3, React Compiler) | `cacheComponents` **disabled** on purpose: every screen is per-user and permission-scoped, so classic dynamic rendering is simpler and removes any risk of caching one user's data for another. |
| Language | TypeScript 5 strict | `npm run typecheck` |
| UI | Tailwind CSS 4, shadcn/ui (Radix base, "nova" preset), Lucide, Inter | Light enterprise theme, tokens in `src/app/globals.css` |
| Forms | React Hook Form + Zod 4 (`@hookform/resolvers`) | The same Zod schemas validate on the client and again on the server |
| Tables | TanStack Table 8 (server-driven: sorting / filtering / pagination come from the URL) | |
| ORM / DB | Prisma 7.10 (`prisma-client` generator + `@prisma/adapter-pg`) on PostgreSQL 17 | Prisma 7 chosen over 6.19 because 6.19's CLI pulls a high-severity `deepmerge-ts` advisory |
| Auth | Custom DB-backed sessions + Argon2id (`@node-rs/argon2`) | Rationale below |
| PDF | `@react-pdf/renderer` (server-side, route handler) | |
| Tests | Vitest 5 (unit + integration on a real Postgres), Playwright 1.65 (E2E on the production build) | |

### Why custom sessions instead of Auth.js
Auth.js v5 is still published as beta, and its credentials provider deliberately does not
support database sessions. The requirements (credential login by email *or* username,
server-side revocation on deactivation / role change / password reset, idle + absolute
expiry, DB-backed rate limiting, audit) are better met by a small, fully tested module:

* 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie `wc_session`.
* Only `SHA-256(token)` is stored (`sessions.token_hash`), so a DB leak does not expose live sessions.
* Idle timeout (`SESSION_IDLE_HOURS`, sliding) + absolute lifetime (`SESSION_MAX_DAYS`).
* Sessions are deleted on logout, deactivation, role change, password reset, and (other devices) on password change.

## Request flow

```
Browser ──► proxy.ts (optimistic: no cookie → /login)            ← not a security boundary
        ──► Server Component page ─► requireUser() (DAL, lib/auth/session.ts)
                                   ─► module service (authorization + Prisma query with scope)
        ──► Server Action ─► runAction() ─► requireActor() ─► service ─► transaction + audit
        ──► GET /api/reports/pdf ─► getSessionUser() ─► reports service (scoped) ─► react-pdf
```

* **Authorization lives in the services**, never only in the UI. Every query is AND-ed with
  a scope from `src/lib/permissions/scopes.ts`, so unauthorized rows are never loaded (no IDOR
  by changing a URL — the record simply is "not found").
* UI checks (`can(user, …)`) only decide what to *show*.

## Folder structure

```
src/
  app/
    (auth)/ login, forgot-password, reset-password, change-password
    (dashboard)/ dashboard, projects, tasks, departments, team-members, settings  (AppShell layout)
    reports/print/          A4 print view (no app chrome)
    api/reports/pdf/        PDF export
  components/
    layout/   AppShell, AppSidebar, AppHeader (global search, notifications, user menu)
    shared/   PageHeader, badges (Status/Priority/Progress), states (Empty/Error/LoadingSkeleton), dialogs (Confirm/Form), UrlTabs, StatCard
    tables/   DataTable, SearchInput, FilterSelect, DateRangeFilter, FilterBar, Pagination
    forms/    Field, FormSection, MultiSelect/SingleSelect (UserMultiSelect, DepartmentMultiSelect, ProjectSelect)
    reports/  ReportActions (print / PDF / WhatsApp), PrintReportLayout, ReportPdf
    projects/ departments/ members/ tasks/ settings/   module UI
    ui/       shadcn primitives
  modules/<module>/  validation.ts (client-safe Zod) · service.ts (server-only) · actions.ts ("use server")
  lib/
    auth/         session (DAL), password (Argon2id), password-policy, tokens, rate-limit
    permissions/  definitions (catalogue + can()), scopes (Prisma where-builders)
    db/           lazy Prisma client
    codes.ts      concurrency-safe business codes
    audit.ts mail.ts whatsapp.ts format.ts errors.ts actions.ts pages.ts env.ts
  generated/prisma/   Prisma client (generated, git-ignored)
prisma/  schema.prisma · migrations/ · seed.ts (roles & permissions only)
scripts/ dev-db.mjs (local Postgres) · bootstrap-admin.ts · seed-demo.ts · perf-check.ts
tests/   unit/ · integration/ · e2e/
```

## Key design decisions

* **One identity per employee.** A team member *is* a `users` row (profile + login). No duplicate identities.
* **One task record.** Multi-department / multi-member assignment uses `task_departments` and
  `task_assignees`; every view (global, project, department, member, dashboard, reports) reads
  the same `tasks` rows through the same scoped queries.
* **Append-only history.** `project_status_updates`, `task_activity`, `audit_logs` have no update/delete paths.
* **Archive, don't delete.** Projects are archived; departments/users are deactivated. No ordinary UI deletes business history.
* **Optimistic concurrency.** `tasks.version` is checked on every update; stale writes get a 409-style conflict.
* **Business codes** (`PRJ-0001`, `TSK-00001`, `DEP-001`, `EMP-0001`) come from an atomic
  `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `code_counters` inside the creating transaction.
* **Sorting by multi-valued columns** uses maintained keys `tasks.department_sort_key` /
  `assignee_sort_key` = the alphabetically-first assigned department / member name (lower-case),
  `NULLS LAST`, tie-broken by task code. Keys are refreshed when assignments change or a
  department / person is renamed.
* **Errors.** Services throw typed `AppError`s; actions return `{ ok:false, error, fieldErrors }`.
  Unknown errors are logged server-side and shown only as a generic message. Route error
  boundaries never render error details.
* **Time zone.** Calendar dates are Postgres `DATE` (UTC midnight). "Today" (overdue) and
  timestamps use `APP_TIMEZONE` (default `Asia/Kolkata`).

## Future modules (Phase 2+)

Items/Stock, Brands, Suppliers, Supplier bills/payments/advances, Rate enquiries, Purchase
orders, Sales orders, Delivery challans, Material-to-site, Running bills and Project accounts
will be added as new `modules/*` with their own tables referencing the stable UUID
`projects.id` (and `organizations.id` for tenancy). The permission catalogue and `scopes.ts`
extend the same way. No financial tables or placeholder values exist in Phase 1; the sidebar
shows Items / Suppliers as disabled "Phase 2" entries.
