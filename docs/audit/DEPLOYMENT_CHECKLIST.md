# Deployment Checklist (nothing has been deployed)

Do not deploy to production until every unchecked item is complete and approved by the owner.

## Before staging
- [ ] Commit the work. **Git currently shows `WATCON-APP/` as entirely untracked** (never committed) — one `git add`/commit is needed before CI/Vercel can build it.
- [ ] Provision managed PostgreSQL (UTF-8, ≥ 14) for **staging**, separate from production.
- [ ] Create migration role and runtime role (least privilege).
- [ ] Set env: `DATABASE_URL` (`?sslmode=require`), `APP_URL` (https), `NODE_ENV=production`, `MAIL_TRANSPORT=smtp` + `SMTP_*` + `MAIL_FROM`, `APP_TIMEZONE`, `NEXT_PUBLIC_APP_TIMEZONE`, `DB_POOL_MAX`.
- [ ] If the provider gives a pooled URL, run migrations with the **direct** URL.

## Staging
- [ ] `npx prisma migrate status` → `npm run db:deploy` → `npm run db:seed`.
- [ ] `npm run bootstrap:admin` once; remove `BOOTSTRAP_*` afterwards.
- [ ] `GET /api/health` → `{"status":"ok","db":"up"}`.
- [ ] Smoke test: login, create dept/member/project/task, progress update as USER, PDF, WhatsApp link, password-reset email actually arrives, logout.
- [ ] Confirm response headers (HSTS, X-Frame-Options, nosniff) and that cookies carry `Secure`.
- [ ] Confirm the proxy sets `X-Real-IP` from the socket address (Vercel does; Nginx needs `proxy_set_header X-Real-IP $remote_addr;`).
- [ ] Run `npm run test:e2e` against a staging-like build.

## Backups / rollback
- [ ] Schedule daily `pg_dump` (or provider PITR). **Rehearse a restore into a scratch DB** (not yet done).
- [ ] Write down rollback: redeploy previous build; migrations are forward-only, so restore from backup if a migration must be undone.
- [ ] Add error monitoring/uptime check on `/api/health` (none configured).

## VPS / Docker option only
- [ ] `docker compose build` (the Dockerfile has **never been built**).
- [ ] Add Nginx + TLS (Let's Encrypt); the repo ships no Nginx config. App port is bound to `127.0.0.1` in compose.

## Production go-live
- [ ] Owner explicitly approves production deployment and production migration.
- [ ] Backup immediately before migration.
