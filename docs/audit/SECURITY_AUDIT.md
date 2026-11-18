# Security Audit — 2026-11-18

Method: my own read of auth/session/schema/reports code, plus an independent read-only review of every server action, service, route handler and serializer by a separate reviewer. Findings below were each re-checked against the code before fixing. No black-box HTTP fuzzing was performed.

**Critical: 0. High: 0.**

## Findings

| # | Sev | Finding | Files | Status |
|---|---|---|---|---|
| 1 | Medium | Rate-limit IP taken from client-controlled left-most `X-Forwarded-For` (per-IP login/reset limits bypassable, audit IP forgeable) | `src/lib/auth/session.ts` | **FIXED** — prefers `X-Real-IP`. Requires the proxy to set it (docs updated) |
| 2 | Medium | Anyone knowing a username could lock that account (incl. Super Admin) out by failing 5 logins | `src/modules/auth/service.ts` | **FIXED** — lockout is per account+IP (5), plus a 20/15 min cross-IP cap. Residual: a distributed attacker can still hit the 20 cap |
| 3 | Medium | Unauthenticated `forgotPassword` deleted admin-issued 24 h reset links and could flood an inbox | `service.ts` | **FIXED** — self-service no longer revokes others; capped at 3/hour per email |
| 4 | Low-Med | Check-then-record rate limit beaten by parallel requests | `rate-limit.ts`, `service.ts` | **FIXED** — attempt reserved before password verify; regression test |
| 5 | Low | Reset-request timing reveals whether an email is registered (SMTP work only for real accounts) | `service.ts` | **OPEN** — needs queued/background mail |
| 6 | Low | No throttle on current-password check in change-password | `service.ts` | **FIXED** (5 failures / 15 min / user) |
| 7 | Low | Email/username change left old reset tokens valid | `members/service.ts` | **FIXED** |
| 8 | Low | Admin could add/remove a Super Admin's department memberships | `departments/service.ts` | **FIXED** |
| 9 | Low | `APP_URL` silently defaulted to localhost in production → broken reset links | `src/lib/env.ts` | **FIXED** — required in production |
| 10 | Low | No HSTS header | `next.config.ts` | **FIXED** (production only; effective once served over HTTPS) |
| 11 | Info | Roles/permissions are global, not per organization. Fine for a single company; a Super Admin of one org would change permissions for all in a multi-tenant setup | `schema.prisma`, `settings/service.ts` | **OPEN (conditional)** — only if multi-org is ever needed |
| 12 | Info | Tasks in archived projects can still be updated/commented | `tasks/service.ts` | **OPEN** — business-rule decision |
| 13 | Medium (functional) | Public logo files redirected to /login by auth proxy | `src/proxy.ts` | **FIXED** |

## Verified sound
Argon2id (19 MiB, t=2); session tokens 256-bit, stored only as SHA-256; httpOnly + SameSite=Lax + Secure in production; idle + absolute expiry enforced server-side; sessions revoked on role change, deactivation and reset; reset tokens hashed, single-use (atomic), 30 min / 24 h; generic login error with timing equalisation; every action authenticates via `runAction`/`requireActor` and re-reads permissions per request; IDs always AND-ed with scope builders (404 not 403 for invisible records); no mass assignment (Zod-parsed + explicit field maps); no `passwordHash`/tokens sent to the browser; raw SQL is only parameterised Prisma tagged templates; no user-controlled HTML (`dangerouslySetInnerHTML` is a fixed dev script); PDF route authorised, `no-store`; production dependency audit clean; `.env` is git-ignored; no hard-coded secrets found; `logging.serverFunctions=false` keeps passwords out of dev logs.

## Not tested
CSRF beyond Next.js server-action origin checks and SameSite=Lax; TLS configuration; HTTP header behaviour behind a real proxy; DB role least-privilege (single role used locally).

## Files changed by this audit
`src/proxy.ts`, `src/app/api/health/route.ts` (new), `src/lib/env.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rate-limit.ts`, `src/modules/auth/service.ts`, `src/modules/members/service.ts`, `src/modules/departments/service.ts`, `next.config.ts`, `docker-compose.yml`, `.env.example`, `docs/DEPLOYMENT.md`, tests (`auth.test.ts`, `members-reports.test.ts`, `audit-coverage.test.ts`). Earlier in this session: company logo component and sidebar/auth layout.
