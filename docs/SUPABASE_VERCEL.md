# Deploy on Vercel + Supabase

Nothing here has been run against a real Supabase project yet. The first connection is the real test (audit gate G11). Supabase dashboard labels move around, so treat button names as approximate and the *concepts* as the stable part.

**Do staging first**: create a second, throw-away Supabase project and a Vercel Preview deployment, run through this once, then repeat for production.

---

## 1. Create the Supabase project

1. New project → pick the region closest to your users (Mumbai `ap-south-1` for India) and note it; you will match the Vercel function region to it.
2. Set a database password. **Use letters + digits only** (e.g. 24 random chars). Special characters must be URL-encoded inside connection strings and are the #1 cause of "authentication failed".
3. Save the password and the **project ref** (the id in the project URL, e.g. `abcdefghijklmnop`).

## 2. Lock down the Supabase Data API (important)

Supabase automatically exposes tables in the `public` schema over a REST API that anyone holding the project's public `anon` key can call. This app does **not** use that API — it talks to Postgres directly — so it must be shut:

- Dashboard → *Project Settings → Data API* (a.k.a. API): **disable the Data API**, or at minimum remove `public` from "Exposed schemas".
- Also enable Row Level Security on every table (after step 4), as a second lock. Prisma connects as the `postgres` role, which bypasses RLS, so the app is unaffected:

```sql
-- Supabase → SQL Editor. Re-run after every migration that adds tables.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
```

## 3. Collect the connection details

Dashboard → **Connect** (top bar). You need two strings and one certificate:

| Purpose | Which one | Looks like |
|---|---|---|
| App runtime on Vercel → `DATABASE_URL` | **Transaction pooler**, port **6543** | `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres` |
| Migrations/seed from your PC → `DIRECT_URL` | **Session pooler**, port **5432** | `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| TLS | Project Settings → Database → *SSL Configuration* → **Download certificate** | a `.pem` file |

- Do **not** use the "Direct connection" host (`db.<ref>.supabase.co`): on the free tier it is IPv6-only and Vercel/most home networks cannot reach it.
- Do **not** add `?pgbouncer=true` — that flag is for Prisma's old engine; this app uses the `pg` driver adapter.
- Why the CA certificate: this app's Postgres driver treats `sslmode=require` as *full verification*, and Supabase's certificate chain is not in Node's trust store, so a plain connection fails with `self-signed certificate in certificate chain`. The app therefore accepts the CA in `DB_SSL_CA` and verifies against it (code: `src/lib/db/adapter-config.ts`). Fallback if you cannot get the CA: append `?sslmode=no-verify` to `DATABASE_URL` — encrypted but the server's identity is not checked (weaker).

## 4. Create the tables and the first admin (once, from your PC)

Use **session-only** environment variables so no secret lands in a file. In PowerShell:

```powershell
cd C:\Users\Admin\Desktop\Sana\WATCON-APP

$env:DIRECT_URL  = "postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:DATABASE_URL = $env:DIRECT_URL            # seed/bootstrap use DATABASE_URL
$env:DB_SSL_CA   = Get-Content "C:\path\to\supabase-ca.pem" -Raw

npx prisma migrate status      # expect: 2 migrations pending on a new database
npm run db:deploy              # applies migrations (uses DIRECT_URL)
npm run db:seed                # roles + permissions only, creates no users
```

Now run the RLS SQL from step 2 in the Supabase SQL Editor, then create the first Super Admin:

```powershell
$env:BOOTSTRAP_ORG_NAME="Watcon"; $env:BOOTSTRAP_ADMIN_NAME="<name>"
$env:BOOTSTRAP_ADMIN_EMAIL="<email>"; $env:BOOTSTRAP_ADMIN_USERNAME="<username>"
$env:BOOTSTRAP_ADMIN_PASSWORD="<strong password, 12+ chars>"
npm run bootstrap:admin        # refuses to run if a Super Admin already exists

Remove-Item Env:DIRECT_URL, Env:DATABASE_URL, Env:DB_SSL_CA, Env:BOOTSTRAP_*   # clean up
```

If the Prisma CLI complains about a certificate for `db:deploy`, add `&sslaccept=accept_invalid_certs` to `DIRECT_URL` **for this one-off run only**.

> Careful: your local `.env` points at the local dev database. Setting `$env:` variables as above overrides it for that PowerShell window only; open a fresh window afterwards before running local dev commands.

## 5. Vercel

1. **Add New → Project → import the Git repo.** The repository root is `Sana/` and contains many unrelated projects, so set **Root Directory = `WATCON-APP`**. Framework preset: Next.js. Build/Install commands: leave default (`npm run build` runs `prisma generate`).
2. **Before first deploy**, commit only this project (the folder is currently untracked). Do **not** use `git add -A` from the repo root — your working tree has many unrelated deleted files. Use `git add WATCON-APP` and review `git status`.
3. **Environment variables** (Settings → Environment Variables):

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | transaction pooler string (6543) | |
| `DB_SSL_CA` | full PEM text of the Supabase certificate | paste with real newlines |
| `DB_POOL_MAX` | `3` | per serverless instance |
| `APP_URL` | `https://<your-domain>` | **required**; used in reset links |
| `APP_TIMEZONE`, `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Kolkata` | the `NEXT_PUBLIC_` one is baked in at build time: redeploy after changing |
| `MAIL_TRANSPORT` | `smtp` + `SMTP_HOST/PORT/USER/PASSWORD/SECURE`, `MAIL_FROM` | without SMTP no reset emails go out (admins can still issue reset links) |
| `SESSION_IDLE_HOURS`, `SESSION_MAX_DAYS` | optional (12 / 7) | |

   **Never set** `DIRECT_URL`, `BOOTSTRAP_*` or local DB values on Vercel.
   Scope production variables to **Production only**. Give **Preview** its own values pointing at the *staging* Supabase project, otherwise preview builds would read and write production data.
4. Settings → Functions → **Function Region**: choose the region closest to Supabase (Mumbai `bom1` for `ap-south-1`).
5. Deploy. Then open `https://<url>/api/health` — expect `{"status":"ok","db":"up",…}`. A 503 with `"check":"config"` means a missing/invalid env var; `"check":"database"` means the database is unreachable (see troubleshooting; details are in the Vercel function logs).
6. Smoke test: log in as the bootstrapped admin, create department → member → project → task, log in as that member, update progress, export PDF, test the WhatsApp link, log out. Then add the custom domain and update `APP_URL`.

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `self-signed certificate in certificate chain` | `DB_SSL_CA` missing, truncated, or not the Supabase cert |
| `password authentication failed` | wrong password, or special characters not URL-encoded; reset the DB password with letters+digits |
| `Tenant or user not found` | username must be `postgres.<ref>` (not plain `postgres`) on pooler hosts; check region host |
| `P1001` / timeout from your PC | you used the IPv6-only direct host; use the Session pooler string |
| `prepared statement … does not exist/already exists` at runtime | transaction-pooler incompatibility (not verified either way here). Switch `DATABASE_URL` to the Session pooler (5432) with `DB_POOL_MAX=1–2` and tell me |
| `MaxClientsInSessionMode` / too many connections | lower `DB_POOL_MAX`; keep runtime on the transaction pooler |
| `/api/health` 503 `config` | missing `APP_URL` or invalid env in Vercel |
| Reset links point to localhost | `APP_URL` not set (production now refuses to start without it) |
| Everything logs out / odd redirects | wrong `APP_URL`/domain mismatch |

## 7. Backups, plan limits, future migrations

- **Backups**: check your Supabase plan — automatic/point-in-time backups are, at the time of writing, a paid-plan feature, and free projects can be **paused after inactivity**. For real company data use a paid plan, *and* take your own `pg_dump` periodically via the Session pooler. **Rehearse a restore into a scratch project before go-live** (audit gate G16).
- **Schema changes later**: change `schema.prisma` → `npm run db:migrate` locally → commit → apply to staging (`db:deploy` with `DIRECT_URL`) → test → apply to production → re-run the RLS SQL → redeploy. Back up before every production migration.
- **Housekeeping**: `rate_limit_events` grows; schedule `DELETE FROM rate_limit_events WHERE created_at < now() - interval '1 day';` (Supabase has a cron extension, or run it occasionally).
