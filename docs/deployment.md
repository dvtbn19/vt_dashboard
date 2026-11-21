# Deployment (not performed yet — needs the owner's accounts)

Target: web on Vercel, API as an always-on container, PostgreSQL on Supabase, files on Cloudflare R2, auth via Supabase Auth.

## Blockers / what the owner must provide

| Item | Where | Used by |
|---|---|---|
| Supabase project | supabase.com | `DATABASE_URL` (pooler URL, `postgresql+psycopg://…`; the transaction pooler on port 6543 is preferred for Vercel), `SUPABASE_URL`, anon key |
| An owner user in Supabase Auth (email + password), sign-ups disabled | Supabase → Authentication | sign-in |
| R2 bucket (private) + API token with Object Read & Write on that bucket | Cloudflare → R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| R2 bucket CORS: allow `PUT` from nothing (SDK uploads are server-to-server) and `GET` from the lab origin if needed | R2 → bucket settings | downloads/previews |
| Container host for the API (e.g. Fly.io, Railway, Render, a small VPS) | provider | runs `services/api/Dockerfile` |
| DNS: `lab.vtcons.com` → Vercel, `api.lab.vtcons.com` → API host | DNS provider | |
| Vercel project setting **Root Directory = `apps/web`** | Vercel → Project → Settings | the repo is now a monorepo; the old root app is gone |

## API environment (production)

```
ENV=production
DATABASE_URL=postgresql+psycopg://...supabase pooler...
# On Vercel the API opens one connection per request and closes it (DATABASE_POOL=auto → no pool),
# because idle function instances holding connections exhaust the session pooler
# ("EMAXCONNSESSION max clients reached in session mode", seen 2026-11-21). Port 6543 (transaction
# pooler) shares server connections between clients and is the better fit; prepared statements are off.
API_PUBLIC_URL=https://api.lab.vtcons.com
CORS_ORIGINS=https://lab.vtcons.com,https://william-doan.vtcons.com
AUTH_MODE=supabase
SUPABASE_URL=https://<ref>.supabase.co
LAB_ALLOWED_EMAILS=<owner e-mail>
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=...
```
Optional — run SQL from the Lab (Queries / Dashboard pages):

```
ANALYTICS_DATABASE_URL=postgresql://team_ro.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
QUERY_TIMEOUT_SECONDS=20
QUERY_MAX_ROWS=5000
```

Use a role that can only `SELECT` the analysis schema — never the `postgres` owner or the
`DATABASE_URL` user. `/health/ready` reports `analytics: ok (role team_ro)` but never fails on it.

Migrations: on Vercel nothing runs `alembic upgrade`; apply new revisions with
`alembic upgrade <from>:<to> --sql` and paste the output into the Supabase SQL Editor.

The app refuses to start with `ENV=production` and `AUTH_MODE=local`, without `SUPABASE_URL`, or without `LAB_ALLOWED_EMAILS`. The container runs `alembic upgrade head` before starting.

## Web environment (Vercel)

```
API_URL=https://api.lab.vtcons.com
LAB_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
# Optional, once both domains are attached to the same Vercel project:
PORTFOLIO_URL=https://william-doan.vtcons.com
LAB_URL=https://lab.vtcons.com
```

With `LAB_URL` set, `lab.vtcons.com/` redirects to `/lab`, portfolio pages requested on the lab host
redirect to `PORTFOLIO_URL`, and `/lab/*` on the portfolio host redirects (308) to the lab host.
`*.vercel.app` preview hosts are not redirected. Supabase session cookies are per host, so sign in
once on the lab host. Add `https://lab.vtcons.com` to Supabase Auth → URL Configuration.

## Order

1. Create Supabase project + owner user; create R2 bucket + token.
2. Deploy the API container with the env above; check `https://api.lab.vtcons.com/health/ready`.
3. In Vercel set Root Directory `apps/web` and the env vars; then push to `main`.
4. Sign in at `https://lab.vtcons.com/lab`, create a token, run the example with `VTCONS_LAB_URL=https://api.lab.vtcons.com`.

Verified in production on 2026-11-18 via `vt-lab-api.vercel.app` (Supabase JWKS auth, R2 presigned upload/download, example run published). Custom domains `lab.vtcons.com` / `api.lab.vtcons.com` are pending DNS.
