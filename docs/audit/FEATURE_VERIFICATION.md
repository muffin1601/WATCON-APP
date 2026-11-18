# Feature Verification — 2026-11-18

"Verified" = exercised by an automated test that ran this session (I = integration against real PostgreSQL, E = Playwright against the production build, U = unit). Anything else is marked.

| Area | Implemented | Verified | Notes |
|---|---|---|---|
| Login email/username, wrong/unknown credentials, inactive account | Yes | I, E | generic error; deactivated message only after correct password |
| Expired / forged session, logout, idle + absolute expiry | Yes | I, E | |
| Password reset (single-use, revokes sessions), change password | Yes | I | email delivery NOT TESTED (console transport) |
| Secure cookie flags | Yes | code review | Secure only when `NODE_ENV=production`; not observed over HTTPS |
| Role boundaries (Super Admin / Admin / User), no self-escalation | Yes | I, U | |
| IDOR on task/project/member by ID | Yes | I, E | unauthorized records return 404 |
| Dashboard counts (scoped, completed ≠ overdue, archived excluded, cancelled handled) | Yes | I | rules documented in `dashboard/service.ts`. Empty-database state NOT separately tested |
| Projects: create, validation, code, list/search/filter, edit, archive/restore | Yes | I, E | |
| Project status history: append-only, author + timestamp, permission-gated | Yes | I, E | |
| Departments: create/duplicate, edit, head, deactivate keeps history, duplicate membership blocked | Yes | I, E | |
| Team members: create, multi-department, duplicate email/username, employee code, activate/deactivate | Yes | I, E | invalid phone formats: validated by unit tests only |
| Tasks: create from global page and project page | Yes | E (project page), I (service) | |
| One task → 1 project, 2 departments, 3 members: single record, visible in all views | Yes | I, E | |
| Status/progress rules, completedAt, reopen rule, cancelled | Yes | U, I | |
| Combined filters, server-side sort + pagination | Yes | I, E | |
| Concurrent edits (optimistic version) | Yes | I, E | |
| Task activity (create/edit/assign/status/progress/due/comment/complete/reopen, with actor) | Yes | I | |
| Print layout, PDF export (valid PDF header), WhatsApp prefilled link | Yes | E | WhatsApp is a `wa.me` link the user must send; nothing is auto-delivered. PDF multi-page layout NOT inspected |
| Health endpoint | Yes (new) | I, build | |
| Company logo (light/dark) | Yes (new) | tsc/eslint, build; **not visually checked** | |

## Static scan results
`TODO|FIXME|mock|lorem` in `src`: none that affect production behaviour (matches were `TODO` as a *task status* and UI `placeholder` props). No hard-coded credentials in source; `docker-compose.yml` requires `POSTGRES_PASSWORD`; test fixtures use throw-away passwords against `_test`/`_e2e` DBs only. No auth bypass flags found.
