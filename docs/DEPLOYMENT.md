# Deployment

> Production deployment and production database changes require explicit approval. Nothing has been deployed.

## Requirements

* Node.js 24 LTS (≥ 20.9 works), PostgreSQL ≥ 14 with **UTF-8** encoding.
* HTTPS termination in front of the app (cookies are `Secure` in production).
* Outbound SMTP for password-reset emails (optional: admins can always issue reset links).

## Environment variables

See `.env.example`. Required in production: `DATABASE_URL`, `APP_URL` (public https URL),
`MAIL_TRANSPORT=smtp` + `SMTP_*` + `MAIL_FROM` (or accept console transport = no reset emails),
`APP_TIMEZONE` / `NEXT_PUBLIC_APP_TIMEZONE`. Optional: `SESSION_IDLE_HOURS` (12), `SESSION_MAX_DAYS` (7), `DB_POOL_MAX` (10).
`BOOTSTRAP_*` only for the one-time bootstrap — remove afterwards. No secret is ever exposed to the browser (no `NEXT_PUBLIC_` secrets).

## Option A — Node server (VM / PM2 / systemd)

```bash
npm ci
npm run db:deploy            # apply migrations
npm run db:seed              # roles & permissions
BOOTSTRAP_ADMIN_NAME=… BOOTSTRAP_ADMIN_EMAIL=… BOOTSTRAP_ADMIN_USERNAME=… BOOTSTRAP_ADMIN_PASSWORD=… npm run bootstrap:admin   # once
npm run build                # prisma generate + next build (output: standalone)
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
node .next/standalone/server.js   # PORT=3000 HOSTNAME=0.0.0.0
```

## Option B — Docker Compose (single server)

```bash
cp .env.example .env         # set POSTGRES_PASSWORD, APP_URL, SMTP_*, BOOTSTRAP_* …
docker compose up -d db
docker compose run --rm migrate                          # migrations + roles
docker compose run --rm migrate npm run bootstrap:admin  # first Super Admin (once)
docker compose up -d app
```
*(Dockerfile/compose were written but not built in the development environment — verify on first use.)*

## Option C — Vercel / managed platforms

Build command `npm run build` (runs `prisma generate`); `postinstall` also generates the client.
Run `npm run db:deploy && npm run db:seed` against the production DB from CI before promoting.
Use a pooled connection string if the platform is serverless and set `DB_POOL_MAX` low (e.g. 3).

## Upgrades

1. Back up the database (`pg_dump`).
2. `npm ci && npm run db:deploy && npm run db:seed && npm run build`, restart.
`db:seed` never removes custom permission grants (except super-admin-only ones from non-super-admin roles).

## Operations

* **Backups**: daily `pg_dump`; history tables are append-only and grow slowly.
* **Housekeeping**: expired sessions are removed on access; `rate_limit_events` older than 24 h can be pruned (`pruneRateLimitEvents()`), e.g. a nightly `DELETE FROM rate_limit_events WHERE created_at < now() - interval '1 day'`.
* **Reverse proxy**: must set `X-Real-IP` from the socket address (Nginx: `proxy_set_header X-Real-IP $remote_addr;`) and overwrite any client-supplied value. The app prefers `X-Real-IP`, falling back to the left-most `X-Forwarded-For`; if the proxy does not set it, per-IP limits can be bypassed (per-account+IP limits still apply). Vercel sets it automatically. Do not expose the app port directly (compose binds it to `127.0.0.1`).
* **Health check**: `GET /api/health` (public, no details) returns 200 `{"status":"ok","db":"up"}` or 503. `APP_URL` is mandatory in production.
* **Locked out?** A Super Admin can issue a reset link to anyone from the member profile. If the only Super Admin is locked out, use `npx tsx` with `createAdminResetLink(userId)` from `src/modules/auth/service.ts` on the server (documented break-glass; audit the action).
