# Phase 1 Plan

Scope: Foundation/Auth/Roles/Dashboard · Projects · Departments · Team Members · Tasks, Reports & Sharing.
Out of scope: inventory, suppliers, procurement, accounting, billing (architecture ready, nothing built).

| Step | Deliverable | Status |
|---|---|---|
| 1 | Repository inspection (empty folder) + plan + docs | ✅ |
| 2 | Next.js 16 / TS strict / Tailwind 4 / shadcn / Prisma 7 / Postgres, env validation, base layout, reusable components | ✅ |
| 3 | Login (email or username), Argon2id, DB sessions, logout, password reset + admin reset links, forced first-login change, rate limiting, RBAC + scopes, bootstrap command | ✅ |
| 4 | Dashboard: 10 live metrics, recent projects, my tasks, overdue, activity, quick actions | ✅ |
| 5 | Projects: CRUD, directory (search/filter/sort/paginate/archive), detail tabs, append-only status paragraphs | ✅ |
| 6 | Departments: CRUD, deactivate, memberships (many-to-many, primary), detail with task views | ✅ |
| 7 | Team members: create/edit/activate/deactivate, profile, multi-department, role boundaries | ✅ |
| 8 | Tasks: CRUD, multi-department/member assignment, owner, detail, comments, progress rules, activity, combined server-side filters, URL state, optimistic concurrency | ✅ |
| 9 | Reports: A4 print, PDF, WhatsApp click-to-chat for task/project/department/member/global | ✅ |
| 10 | Typecheck, lint, unit, integration, E2E, build, audit, security review, deployment config | ✅ (see TESTING.md) |
