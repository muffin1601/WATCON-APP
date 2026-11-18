# Database

PostgreSQL 17 (any ≥ 14 works), UTF-8 encoding required. Schema: `prisma/schema.prisma`.
Migrations: `prisma/migrations/` (`20261117110951_init`, `…_nullable_sort_keys`).

## Tables

| Table | Purpose |
|---|---|
| organizations | Company profile (name, address, logo). Every business table carries `organization_id` (multi-tenant ready). |
| code_counters | `(organization_id, scope) → value` sequences for business codes |
| roles, permissions, role_permissions | RBAC catalogue + grants |
| users | Employee profile **and** login (one identity). `employee_code`, email/username unique, Argon2id hash, status, primary department, MFA foundation columns |
| sessions | Hashed session tokens, expiry, IP / user agent |
| password_reset_tokens | Hashed single-use tokens |
| rate_limit_events | Shared login / reset rate limiting |
| departments | Code, name (unique per org), head, status |
| department_members | Many-to-many users ↔ departments (PK prevents duplicates) |
| projects | Code, site name/address, description, dates, priority, status, manager, archive fields |
| project_members | Many-to-many users ↔ projects |
| project_status_updates | **Append-only** status paragraphs (latest = current status) |
| tasks | One row per task; status, progress, owner, `version` (optimistic lock), sort keys |
| task_departments, task_assignees | Many-to-many assignment junctions |
| task_comments | Comments |
| task_activity | **Append-only** history (action, actor, from/to JSON) |
| audit_logs | **Append-only** organisation audit trail |
| notifications | In-app notifications (assignment, comments) |

## Integrity rules

* UUID primary keys (`gen` in Prisma). Human codes are unique per organisation.
* Business records use `ON DELETE RESTRICT` toward history (projects ← tasks ← status updates, users ← activity), so history cannot be deleted accidentally. Junction rows cascade with their task.
* Related writes run in a single transaction (e.g. task + junctions + sort keys + activity + notifications + audit).
* Indexes on every foreign key used for filtering, plus `(organization_id, status|due_date|created_at|priority|sort keys)` on tasks, `(organization_id, status|updated_at|name)` on projects, `(task_id, created_at)` on history tables.

## Business code generation

```sql
INSERT INTO code_counters (organization_id, scope, value) VALUES ($1, $2, 1)
ON CONFLICT (organization_id, scope) DO UPDATE SET value = code_counters.value + 1
RETURNING value;
```
Executed inside the creating transaction; the row lock serialises concurrent creators, so codes
are never duplicated (verified by an integration test creating 8 projects concurrently).

## Commands

| Command | What it does |
|---|---|
| `npm run db:start` | Local PostgreSQL 17 (embedded, port 5433) with `watcon_dev`, `watcon_test`, `watcon_e2e` |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply migrations (production/CI) |
| `npm run db:seed` | Sync roles & permissions (idempotent, no users/business data) |
| `npm run bootstrap:admin` | One-time organisation + first Super Admin from `BOOTSTRAP_*` env |
| `npm run seed:demo -- --tasks 5000` | Dev/test only: realistic volume data (refuses production) |
