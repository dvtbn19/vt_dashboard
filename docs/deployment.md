# Deployment (not performed yet — needs the owner's accounts)

Target: web on Vercel, API as an always-on container, PostgreSQL on Supabase, files on Cloudflare R2, auth via Supabase Auth.

## Blockers / what the owner must provide

| Item | Where | Used by |
|---|---|---|
| Supabase project | supabase.com | `DATABASE_URL` (session pooler URL, `postgresql+psycopg://…`), `SUPABASE_URL`, anon key |
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
API_PUBLIC_URL=https://api.lab.vtcons.com
CORS_ORIGINS=https://lab.vtcons.com,https://william-doan.vtcons.com
AUTH_MODE=supabase
SUPABASE_URL=https://<ref>.supabase.co
LAB_ALLOWED_EMAILS=<owner e-mail>
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=...
```
The app refuses to start with `ENV=production` and `AUTH_MODE=local`, without `SUPABASE_URL`, or without `LAB_ALLOWED_EMAILS`. The container runs `alembic upgrade head` before starting.

## Web environment (Vercel)

```
API_URL=https://api.lab.vtcons.com
LAB_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
```

## Order

1. Create Supabase project + owner user; create R2 bucket + token.
2. Deploy the API container with the env above; check `https://api.lab.vtcons.com/health/ready`.
3. In Vercel set Root Directory `apps/web` and the env vars; then push to `main`.
4. Sign in at `https://lab.vtcons.com/lab`, create a token, run the example with `VTCONS_LAB_URL=https://api.lab.vtcons.com`.

Not yet verified against real Supabase/R2 (no credentials were available): the JWKS verification path and R2 presigned URLs are implemented and unit-level checked only.
