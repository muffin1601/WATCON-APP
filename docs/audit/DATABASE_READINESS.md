# Database Readiness — 2026-11-18

## Status
- PostgreSQL configured: **local only** (`DATABASE_URL` → `localhost:5433/watcon_dev`, embedded PG17). **DATABASE NOT CONNECTED to any managed or production PostgreSQL.**
- Real (target) connection tested: **NO** (G11 BLOCKED).
- Prisma schema valid: **YES** (`prisma validate`).
- Migrations: 2 (`init`, `nullable_sort_keys`). Applied from scratch on a fresh DB on every integration run; no drift against dev or test DB.
- Production migration approval required: **YES** — nothing was applied to any production DB.

## Required tables (equivalents)
organizations, users, roles, permissions (+ role_permissions), departments, department_members, projects, project_members, project_status_updates, tasks, task_departments, task_assignees, task_comments, task_activity, audit_logs — all present. Extras: sessions, password_reset_tokens, rate_limit_events, code_counters, notifications.

## Integrity (schema review + tests)
- Unique: project/task/department/employee codes per org; user email and username (global); department name per org.
- Composite primary keys prevent duplicate `department_members`, `task_departments`, `task_assignees`, `project_members`.
- Foreign keys use `Restrict` for history (tasks, status updates, comments, activity, audit) so history cannot be orphaned; `SetNull` for optional links; `Cascade` only for sessions, tokens, membership join rows.
- Tested: duplicate department/email/username → CONFLICT; concurrent code generation yields unique codes; optimistic task versioning rejects stale writes; department deactivation keeps task history; append-only project status history.
- Indexes present for org+status, due date, created date, priority, assignee/department sort keys, FK columns. Measured query medians ≤ 14 ms at 10k tasks.
- **Not tested:** FK violation injection via raw SQL, rollback under injected failure, DB-level least privilege.

## Connection configuration
- Runtime: `DATABASE_URL`, pool via `DB_POOL_MAX` (default 10; 3–5 on serverless). Prisma 7 driver adapter (`pg`).
- **No separate `DIRECT_URL`**: `prisma.config.ts` uses `DATABASE_URL` for migrations too. With a pooled/pgbouncer URL (e.g. Supabase/Neon pooler), migrations must run with the *direct* URL — set `DATABASE_URL` to the direct URL for the `db:deploy` step only.
- TLS: add `?sslmode=require` (documented in `.env.example`). **Not tested.**
- Database is created UTF-8; encoding is verified by `scripts/dev-db.mjs`. Ensure the same on managed Postgres.

## Connect a real database — steps
1. Create an empty PostgreSQL ≥ 14 database (UTF-8) and two roles: a migration role (DDL) and a runtime role (SELECT/INSERT/UPDATE/DELETE only on the schema). Currently the app works with one role; least privilege is recommended, not enforced.
2. In the deploy environment set `DATABASE_URL` (+ `?sslmode=require`), `APP_URL` (https), `NODE_ENV=production`, SMTP vars, timezone vars.
3. Take a backup if the database is not empty. Run `npx prisma migrate status`, then `npm run db:deploy` and `npm run db:seed` (roles/permissions only, creates no users).
4. `npm run bootstrap:admin` once (first Super Admin); then delete `BOOTSTRAP_*` from the environment.
5. Verify `GET /api/health` returns `{"status":"ok","db":"up"}`.

## Backups / restore
Documented (`pg_dump` daily) but **NOT TESTED** — no `pg_dump`/`pg_restore` available on this machine. A restore into a scratch database must be rehearsed before go-live (G16).
