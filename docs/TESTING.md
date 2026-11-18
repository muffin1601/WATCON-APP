# Testing

## Suites

| Suite | Command | Where it runs | Count |
|---|---|---|---|
| Unit | `npm run test:unit` | pure functions | 32 tests |
| Integration | `npm run test:integration` | services against the dedicated `watcon_test` DB (schema dropped and re-migrated each run; refuses any DB not ending in `_test`) | 26 tests |
| E2E | `npm run build && npm run test:e2e` | Playwright/Chromium against the **production build** on port 3100 with `watcon_e2e` (reset + bootstrapped each run) | 9 tests (full workflow) |

Prerequisite for integration/E2E locally: `npm run db:start` (or set `TEST_DATABASE_URL` / `E2E_DATABASE_URL`).

## Coverage map

**Unit** — task status/progress rules (complete ⇔ 100%, To Do semantics, reopen rule, blocked/cancelled),
completion rate (cancelled excluded), overdue & business time zone, `can()` incl. super-admin-only
permissions, scope builders, business-code formatting, project/task/member/password schemas,
URL query coercion, combined filter builder, sort semantics, WhatsApp number normalisation, links and length cap.

**Integration** — login by email/username, hashed session tokens, generic error for unknown vs wrong
password, inactive accounts, account rate-limit, idle + absolute session expiry, logout, password-reset
(no enumeration, single use, revokes sessions), change password; project creation, concurrent unique
codes, append-only status history, status permissions; department creation/duplicate names; members in
multiple departments with one primary and duplicate-membership prevention; admin/user role boundaries;
deactivation revokes sessions; reset links; role-permission editing guard; task creation with multiple
departments & members (one record visible everywhere); validation (owner ∈ assignees, dates, inactive
departments, project access); IDOR (user/other admin cannot see or update); assignee progress updates,
completion/reopen activity; **concurrent updates (one wins, one gets CONFLICT)**; edit/reassign activity;
comments; combined filters + assignee sort; scoped dashboard metrics; report authorization & WhatsApp text.

**E2E** (`tests/e2e/phase1-workflow.spec.ts`) — the 18 required steps: Super Admin login → creates Admin
→ departments (incl. invalid/duplicate) → members in multiple departments → project (validation, then
create) → two status paragraphs + history → task from the project page (preselected project, invalid
dates rejected) with 2 departments and 3 members → user first-login password change → sees task, cannot
see another user's task → updates progress, comments → unauthorized pages/PDF blocked → admin sees
update → combined filters → print layout (print CSS hides toolbar) → PDF export (`%PDF`) → WhatsApp link
prefilled with the member's number → inactive account blocked → forged/expired session redirected →
concurrent update in two browsers rejected for the stale one.

## Last recorded run (2026-11-17, Windows 11, Node 24.12, PostgreSQL 17.11)

```
npx tsc --noEmit            → 0 errors
npx eslint src tests scripts → 0 problems
npx vitest run              → 6 files, 58 passed
npm run build               → success (24 routes)
npx playwright test         → 9 passed (50.1s)
npm audit --omit=dev        → 0 vulnerabilities
```

## Performance check (5,000 tasks, 40 people, 25 projects — `scripts/perf-check.ts`)

Median service latency on local Postgres: dashboard 8–12 ms, task register 4–6 ms, combined filters
3.5–4.6 ms, department-sorted page 20 ≈ 6 ms, projects 3–5 ms, departments 7–24 ms, members 15–18 ms.
```
npm run seed:demo -- --tasks 5000        # requires DEMO_PASSWORD, refuses non-dev DBs
npx tsx --conditions=react-server scripts/perf-check.ts
```

## Not covered (honest gaps)

* No cross-browser matrix (Chromium only), no screen-reader session, no load test with concurrent HTTP users.
* SMTP delivery is not tested end-to-end (console transport in tests).
* Docker images were not built in this environment (Docker unavailable); the Dockerfile is unverified.
