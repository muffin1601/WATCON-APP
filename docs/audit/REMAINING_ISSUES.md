# Remaining Issues — 2026-11-18

## BLOCKED (need a decision or an environment from the owner)
1. **Real database connectivity (G11)** — no managed/VPS PostgreSQL provided. Supply a *staging* database URL to proceed.
2. **Staging deployment + smoke tests (G17)** — needs a target (Vercel or Ubuntu VPS). Choose A or B.
3. **Backup/restore rehearsal (G16)** — needs `pg_dump`/`pg_restore` and a scratch database.
4. **Production deployment/migration** — requires explicit owner approval; not attempted.

## Open — Medium/Low
| Sev | Issue | Suggested action |
|---|---|---|
| Low | Reset-request timing can reveal whether an email is registered | Send mail in the background / fixed-time response |
| Low | Distributed attacker can still hit the 20-attempt per-account cap and lock the real user out for 15 min | Add alerting, or CAPTCHA after repeated failures |
| Info | Tasks in archived projects remain editable | Decide whether archived = read-only |
| Info | Roles/permissions are global (single-company assumption) | Revisit only if multi-organisation is planned |
| ~~Medium (ops)~~ | ~~No `DIRECT_URL` split for pooled providers~~ | **DONE** — `prisma.config.ts` prefers `DIRECT_URL`; `DB_SSL_CA` added for Supabase TLS. See `docs/SUPABASE_VERCEL.md`. Still unverified against a real Supabase project |
| Medium (security) | Supabase exposes `public` tables via its Data API | Disable Data API + enable RLS on all tables (SQL in the guide); re-run after each migration |
| Medium (ops) | No error monitoring, no Nginx config in repo, Dockerfile never built | Complete during staging |
| Low | Perf test used 10k tasks but fewer projects/members than the requested 100/200; no concurrent-user load test | Re-run at full volume on staging |
| Low | PDF multi-page/long-text layout not visually inspected; logo not visually checked | Manual review |
| Low | Browser matrix is Chromium only | Add Firefox/WebKit if required |

## Housekeeping
- `WATCON-APP/` is untracked in git (never committed).
- Local `.env` contains `BOOTSTRAP_ADMIN_*` values; remove after the real bootstrap and never reuse the local password in production.
- `.env.example` default `DATABASE_URL` contains the local dev password `watcon_local_dev` (local-only, non-secret) — acceptable, but do not reuse.
