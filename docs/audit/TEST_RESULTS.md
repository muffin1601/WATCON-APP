# Test Results — 2026-11-18

Environment: Windows 11, Node 24.12, PostgreSQL 17.11 (embedded, local). All commands actually executed.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (strict mode on) |
| `npx eslint src tests scripts` | exit 0 |
| `npx prisma validate` | schema valid |
| `npx prisma generate` | OK (7.10.1) |
| `npx prisma migrate status` (dev DB) | 2 migrations, up to date |
| `npx prisma migrate diff --from-config-datasource --to-schema …` (dev + test DB) | no difference |
| `npx vitest run` | **7 files, 68 tests passed** (32 unit, 36 integration) |
| `npm run build` | success (run twice: before and after fixes) |
| `npx playwright test` | **9 passed** before fixes, **9 passed** after fixes (~51 s) |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Tests added this audit (10)
- auth: lockout is per account+IP (attacker cannot lock the real user out); distributed per-account cap; parallel burst cannot exceed limit; self-service reset cannot cancel an admin link and is capped per email; change-password guessing throttled.
- members: email change invalidates outstanding reset links; admin cannot change a Super Admin's department memberships.
- coverage gaps: project edit + archive/restore (+ dashboard count + audit log); department rename + head; server-side pagination (disjoint pages, correct total, scope); `/api/health`.

## Failure found and fixed during the run
First E2E run completed 9/9 but the server log showed `internal image response failed for /logo1.png 307`: the auth proxy redirected the public logo files to `/login`, so the logo would not display for signed-out users. Fixed in `src/proxy.ts`; re-run shows 0 server errors.

## Performance (measured, local PostgreSQL, `scripts/perf-check.ts`)
Data: 10,002 tasks, 20,004 assignments, 20,002 task-department links, 26 projects, 8 departments, 45 users. Seeded into the disposable `watcon_e2e` DB.
Medians over 5 runs: dashboard 9–14 ms; task register 3–5 ms; combined filters + overdue 4–6 ms; department-sorted page 4–5 ms; projects 3–13 ms; departments 10–13 ms; members 5–7 ms. Worst single run: 93 ms (cold dashboard).
**Not met:** the requested volume was 100 projects / 20 departments / 200 members; the demo seeder produces fewer. No concurrent-HTTP load test and no memory-leak test were run.

## Not covered
Chromium only; no load test; SMTP delivery not tested (console transport); Docker image not built; PDF multi-page visual layout not inspected; no restore test.
