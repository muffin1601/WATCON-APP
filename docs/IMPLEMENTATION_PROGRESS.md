# Implementation Progress — Phase 1

_Last updated: 2026-11-17_

## Status: **Phase 1 COMPLETE (code + automated verification)** — not deployed

Deployment to a real server has not been performed (requires approval and production
credentials). Everything below was executed locally against real PostgreSQL 17.

## Completed modules

1. Foundation, authentication, roles & permissions, dashboard
2. Projects (directory, CRUD, archive, detail tabs, append-only status paragraphs)
3. Departments (CRUD, deactivate, many-to-many memberships with primary department)
4. Team members (accounts = profiles, multi-department, role boundaries, activate/deactivate, reset links)
5. Tasks (multi-department / multi-member, accountable owner, rules, comments, activity, combined filters, concurrency) + reports (print, PDF, WhatsApp)

## Database migrations

* `20261117110951_init` — full Phase 1 schema
* `…_nullable_sort_keys` — `NULLS LAST` sorting for unassigned tasks

## Tests executed (2026-11-17)

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `eslint src tests scripts` | 0 problems |
| Vitest unit | 32 / 32 passed |
| Vitest integration (real Postgres) | 26 / 26 passed |
| Playwright E2E (production build) | 9 / 9 passed |
| `npm run build` | success |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Performance (5,000 tasks) | all list/dashboard queries < 25 ms median |

## Bugs found and fixed during verification

* Local Postgres initialised with WIN1252 encoding on Windows → non-Latin text failed. Forced `--encoding=UTF8` and added a startup check.
* Zod 4: `z.union([..., z.undefined()])` does not make an object key optional → optional dates rejected when omitted. Fixed with `.optional()`.
* Super Admin profiles could not be edited (update schema rejected the SUPER_ADMIN role) → schema accepts it unchanged; promotion to Super Admin is blocked in the service.
* Mobile date-range filters overflowed at 390 px → responsive widths.
* Lint: JSX inside try/catch in the PDF route; TanStack Table/React Compiler warning acknowledged.

## Phase 1 acceptance criteria

- [x] Secure login works
- [x] Super Admin can manage accounts
- [x] Admin permissions work correctly
- [x] Users can access only authorized information
- [x] Dashboard displays real database values
- [x] Projects can be created and edited
- [x] Existing projects can be searched and opened
- [x] Project status paragraphs are saved with history
- [x] Departments can be created and managed
- [x] Team members can be created and managed
- [x] Members can belong to multiple departments
- [x] Tasks can be created from global and project pages
- [x] Tasks can be assigned to multiple departments
- [x] Tasks can be assigned to multiple team members
- [x] Task assignments appear correctly across all modules
- [x] Users can update their authorized tasks
- [x] Task activity is recorded
- [x] Combined task filters work
- [x] Project / department / member task reports work
- [x] PDF exports work
- [x] Print layouts work
- [x] WhatsApp sharing opens correctly (wa.me link verified; WhatsApp itself not opened in CI)
- [x] All required permissions are enforced server-side
- [x] Database migrations work
- [x] Automated tests pass
- [x] Production build succeeds
- [x] Deployment instructions are complete
- [x] No known critical security issues remain

## Known issues / limitations

1. **PDF fonts**: PDFs use built-in Helvetica (Latin only). Names in Devanagari or other scripts will not render in the PDF (the browser print view is fine). Fix: embed a Noto font in `report-pdf.tsx`.
2. PDF truncates single task descriptions above 1,200 characters (print view shows full text); reports cap at 2,000 tasks with a notice.
3. Task comments are not paginated.
4. MFA: schema columns + login hook point only; not implemented.
5. SMTP email delivery not tested end-to-end; admins can always issue reset links instead.
6. Dockerfile / docker-compose not built here (no Docker on the dev machine).
7. Dev-only dependency advisory: 4 moderate findings via the shadcn CLI (`ts-morph`); not shipped to production.
8. Per-IP login limiting trusts `X-Forwarded-For`; deploy behind a proxy that sets it (per-account limiting is unaffected).
9. UI is single-organisation (tables are multi-tenant ready).

## Next exact development step

Phase 2 planning (Items / Suppliers). Optional Phase 1 polish: embed a Unicode font for PDFs, paginate comments, implement TOTP MFA.

## Continuation prompt (if resuming)

> Continue the Watcon Enterprise app in `WATCON-APP`. Read `docs/IMPLEMENTATION_PROGRESS.md`, `docs/ARCHITECTURE.md`
> and `docs/PERMISSIONS.md`. Start the local DB with `npm run db:start`, run `npm test` and `npm run build && npm run test:e2e`
> to confirm a green baseline, then work on: <next item>.
