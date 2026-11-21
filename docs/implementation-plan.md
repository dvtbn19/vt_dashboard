# Implementation plan — VTCONS Project Lab (M0–M2)

Source of truth for intent: `CLAUDE.md`. This file tracks *how* we get to the MVP and what is done.

## 0. Starting point (inspected 2026-11-17)

- `HEAD` (cde35bf) holds a previous single Next.js app (portfolio + "VT Lab", Neon + Vercel Blob, password login, agent reports API). It is deployed on Vercel from the repo root.
- The working tree had every file of that app deleted (uncommitted), leaving only `CLAUDE.md`. We treat this as an intentional restart on the new architecture. The old code stays recoverable from git history.
- Reused from the old code: **only the owner's real profile content** (career, links, impact statements) so nothing personal is invented. UI is rebuilt per `CLAUDE.md` §9.
- Local machine: Node 22, Python 3.13 (Homebrew). Docker daemon and PostgreSQL are not reachable from the agent sandbox, so automated tests run on SQLite locally and on PostgreSQL in CI; migrations are checked against PostgreSQL with Alembic offline SQL generation.

## 1. Architecture summary

See `docs/architecture.md` (diagram, trade-offs) and `docs/api-contract.md` (endpoints).

```
Python script / agent ──SDK──▶ FastAPI (/v1) ──▶ PostgreSQL (metadata)
        │                         │
        └──PUT presigned URL──▶ Object storage (R2 in cloud, local disk adapter in dev)
Browser ──▶ Next.js (server components call FastAPI with the user's JWT) ──▶ FastAPI
```

## 2. Ordered tasks

Dependencies flow top to bottom. Each milestone must leave the system runnable.

### M0 — Foundation
- [x] Inspect repository, record findings (above)
- [x] Monorepo layout: `apps/web`, `services/api`, `packages/agent_sdk`, `workflows/examples`, `infra/compose`, `docs`
- [x] FastAPI app skeleton, settings via env (`pydantic-settings`), `.env.example` files
- [x] SQLAlchemy models + Alembic migration `0001_initial`
- [x] `/health/live`, `/health/ready` (ready checks DB + storage)
- [x] Docker Compose for PostgreSQL (loopback-only port)
- [x] Ruff + mypy + pytest for API; ESLint + `tsc` + build for web
- [x] GitHub Actions CI (API tests on Postgres service, SDK tests, web lint/typecheck/build)

**Acceptance:** `uvicorn` starts, `/health/ready` returns 200 with DB reachable and 503 otherwise; `alembic upgrade head` creates the schema; CI config is valid.

### M1 — Portfolio + Project Registry
- [x] Auth: Supabase JWT verification (HS256 secret or JWKS) in the API; local-dev auth mode that is refused when `ENV=production`
- [x] Owner allow-list (`LAB_ALLOWED_EMAILS`) so a random Supabase sign-up cannot use the lab
- [x] Users auto-provisioned from verified JWT claims
- [x] Projects API: list/create/get/patch with owner checks, slug, status, visibility
- [x] Public projects endpoint (only `visibility=public`)
- [x] Web: public portfolio `/`, `/projects`, `/projects/[slug]`
- [x] Web: `/lab` shell (sidebar desktop, bottom nav mobile), overview, project list/create, project detail/edit
- [x] Login page (Supabase email+password, or local dev login), sign-out, auth-expired handling
- [x] Loading / empty / error / unauthorized states

**Acceptance:** signed-out users are redirected from `/lab`; API returns 401 without a token and 404 for another owner's project; project CRUD works from the UI.

### M2 — Universal Run & Artifact Publishing
- [x] Entities: `runs`, `metrics`, `artifacts`, `agent_credentials`, `idempotency_records`
- [x] Agent credentials: create (token shown once), list, revoke; SHA-256 hashed; scoped to projects + permissions
- [x] Runs API: create (idempotency key), list, detail, complete, fail
- [x] Metrics API: batch log scalar metrics with optional step
- [x] Storage abstraction: `LocalStorage` (HMAC-signed URLs served by the API) and `R2Storage` (S3 presigned URLs)
- [x] Artifacts API: initiate → PUT upload → complete (size, checksum, type sniffing) → download URL / bounded preview
- [x] Types: PNG/JPEG, CSV (bounded preview), Markdown (rendered without raw HTML), Plotly JSON
- [x] Python SDK `vtcons-lab-sdk`: `LabClient`, `start_run`, `log_metric(s)`, `log_artifact`, `complete/fail`, context manager, timeouts, retries only for safe/idempotent calls
- [x] Example `workflows/examples/ecommerce_eda/` (synthetic, fixed seed, clearly labelled) publishing a correlation heatmap, CSV preview, Markdown report, Plotly chart and metrics
- [x] Web: run detail page with metrics, image/table/markdown/chart previews and downloads
- [x] Web: settings page for agent tokens
- [x] Integration tests: auth negatives, cross-owner access, scope enforcement, run lifecycle, artifact lifecycle + retrieval, size/MIME rejection
- [x] Manual smoke test documented in `docs/setup.md`

**Acceptance (MVP DoD):** sign in → create/open project → run the example → see the uploaded results (on a phone-width screen too). Tests pass. Remaining cloud setup steps are explicit in `docs/setup.md` / `docs/deployment.md`.

## 2b. Owner-requested additions (2026-11-21)

- [x] Working notes per project: Markdown editor in the Lab (write / split / preview, autosave, Cmd+S), optimistic concurrency (409 + "keep mine" / open latest), agents with `notes:write`
- [x] Saved SQL queries per project + live read-only execution against `ANALYTICS_DATABASE_URL` (user only), result table, CSV download, bar/line/scatter chart saved with the query
- [x] Project dashboard: every saved query with a chart, run live
- [x] SDK: `publish_note`, `create_note`, `update_note`, `save_query`, `list_*`
- [x] Migration 0003 (`notes`, `saved_queries`, RLS on)

## 3. Out of scope now

M3–M6 (runners, hybrid execution, control center, MLOps integrations) — captured in `docs/roadmap.md`. The schema leaves room: runs carry `source`, `params`, `tags`; credentials carry permission scopes that can later include `tasks:claim`.

## 4. Status log

- 2026-11-17 — Plan written, M0–M2 implemented. Verified locally: API 19 tests (SQLite), SDK 6 tests, ruff + mypy clean, web lint + typecheck + production build pass; Alembic PostgreSQL DDL generated offline. Manual smoke test done in a real browser against running servers: sign-in (wrong + right password), project created in the UI, token created in the UI, `run_eda.py` published a run, run page showed 8 metrics + PNG + Plotly + Markdown + CSV, downloads worked, phone width OK, revoked token rejected with 401.
- Not verified: tests on a live PostgreSQL (no Docker/Postgres reachable from the agent sandbox; CI runs them), Supabase JWT/JWKS against a real project, R2 presigned URLs against a real bucket, the API Dockerfile build. Deployment not performed (needs Vercel root-dir change, API host, Supabase and R2 credentials — see `docs/deployment.md`).
- 2026-11-21 — Notes, saved queries, live SQL and dashboard added at the owner's request. Verified locally: API 39 tests (SQLite) incl. read-only/multi-statement/scope/ownership negatives, SDK 6 tests, ruff + mypy clean, web lint + typecheck + build. Browser check against running servers (SQLite analytics DB loaded from the Range Review CSVs): note autosave, conflict warning and "keep mine", query run → table → chart → save, dashboard, phone width. Not verified locally: the PostgreSQL path of the query runner (CI runs the same tests on Postgres) and Supabase `team_ro` in production.
