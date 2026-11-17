# CLAUDE.md — VTCONS Project Lab

> Project instructions for Claude Code. Read this file fully before making changes. Treat it as the source of truth for project intent, scope, engineering constraints, and delivery standards. The human owner communicates primarily in Vietnamese; use Vietnamese in reports, questions, and progress summaries. English is fine for code, identifiers, comments, and technical documentation where appropriate.

## 1. Project mission

Build **VTCONS Project Lab**, a real, deployable **personal portfolio + private data/AI project laboratory** linked to subdomains of `vtcons.com`.

This platform is the owner's online home for:
- A polished public portfolio: introduction, skills, selected projects, case studies, links, and contact details.
- A private dashboard aggregating projects and the progress of Data Engineering, Data Science, EDA, ML, Deep Learning, and AI Agent work.
- A universal place where Python scripts and AI agents (e.g., Claude Code, Codex, custom agents, Airflow tasks) can **publish analysis artifacts**: images, CSV/Parquet files, interactive charts, Markdown reports, model metrics, logs, etc.
- Later, a **hybrid agent control plane**: dashboard and API stay online while workloads execute on the owner's Mac laptop (macOS/Docker) or on cloud workers, with remote task dispatch, status, review, and approvals.

**Important scope rule:** The long-term vision is ambitious, but do not build every component now. Start with a small working vertical slice and grow incrementally. A useful end-to-end MVP is better than an elaborate unfinished architecture.

## 2. Architectural principles

1. **Always-on control plane; detachable execution plane.** Web app, API, and persistent data must not depend on the laptop being powered on. Agent runners may be local or cloud.
2. **API-first, artifact-first.** External projects should publish results through a stable authenticated API / SDK, not by writing directly to the app database.
3. **Private by default.** All projects, runs, files, and logs are private unless explicitly marked and reviewed for publication to the portfolio.
4. **Separation of concerns.** The web app handles presentation; FastAPI handles business logic and authorization; PostgreSQL stores structured metadata; object storage keeps files; workers run compute-heavy jobs.
5. **Simple now, extensible later.** Avoid premature microservices, Kubernetes, Kafka, Airflow-as-job-queue, vector databases, or always-on GPUs.
6. **Reproducibility.** Preserve runs and metadata instead of overwriting results; capture timestamps, parameters, source version (if known), and dataset/model version (if available).
7. **Security and cost awareness.** No arbitrary shell commands from the dashboard, unrestricted execution, public artifact buckets, or automatic paid GPU provisioning.
8. **Real implementation.** No fake completion claims, nonfunctional buttons, placeholders that appear functional, or fabricated analytics data without a clearly marked demo label.
9. **Developer experience.** Prioritize understandable code, reproducible local setup, clear `.env.example`, testability, and useful documentation for macOS (zsh) + Docker Desktop.

## 3. Target stack (preferred)

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui; responsive layouts; accessible components.
- **Charts:** ECharts and/or Plotly, added as needed rather than both by default.
- **Backend:** Python FastAPI, Pydantic, SQLAlchemy, Alembic.
- **Metadata DB:** PostgreSQL. Prefer Supabase-managed PostgreSQL for the deployed environment; local PostgreSQL via Docker Compose is acceptable for development.
- **User authentication:** Supabase Auth; validate tokens and permissions in the backend. No UI-only authorization. If cloud credentials are missing, document the manual setup and keep testable local code; never introduce a production authentication bypass.
- **Artifact storage:** Cloudflare R2 (S3-compatible) in deployment. Use a local development storage adapter if credentials are not yet configured; keep a compatible storage abstraction.
- **API / frontend deployment:** FastAPI on an always-on container/VPS service; Next.js on Vercel or an equivalent host.
- **Python SDK:** Small reusable `vtcons-lab-sdk` package for publishing runs, metrics, and artifacts from external repos.
- **Hybrid runners (later):** Python worker + Docker. Cloud and local runners use the same task protocol.
- **MLflow, Redis, Celery, Airflow integration, Kubernetes:** deferred until there is a concrete need.

If a different technology is materially better, briefly document the trade-off and use the simplest robust choice; avoid switching frameworks for aesthetic reasons.

## 4. Domains and product surfaces

Design with configurable domains, not hardcoded URLs:
- `william-doan.vtcons.com`: public portfolio (already live on Vercel; or `vtcons.com` if the owner later chooses).
- `lab.vtcons.com`: authenticated Project Lab.
- `api.lab.vtcons.com`: backend API.

For MVP, a **single Next.js codebase** can serve public routes (`/`, `/projects`, `/projects/[slug]`) and private routes (`/lab`, `/lab/projects/[id]`, `/lab/runs/[id]`, `/lab/settings`). Different subdomains can be wired during deployment; do not make deployment-dependent routing a blocker for local development.

Portfolio is public-facing and curated; Project Lab exposes full work history and is private.

## 5. MVP scope — IMPLEMENT FIRST (Milestones M0–M2)

The first real outcome is:

> From an external Python script on a laptop, create a run for an E-Commerce Sales Analysis project, publish a correlation chart, a small dataset preview, a Markdown EDA report and scalar metrics, then view those real uploaded results in a private, mobile-friendly web dashboard.

### M0 — Foundation

- Inspect the existing repository before creating/replacing files. Preserve existing work. If empty, initialize a clean monorepo.
- Scaffold Next.js + FastAPI + SQLAlchemy + Alembic + PostgreSQL and organize environment configuration.
- Define API contracts and a concise architecture document; add `.env.example` (no secrets committed).
- Provide Docker Compose for local development dependencies and clear macOS/zsh-friendly setup commands.
- Add linting, type checks, backend tests, and a basic CI workflow.
- Implement `/health/live` and `/health/ready` endpoints; readiness must check critical dependencies.

### M1 — Portfolio + Project Registry

- Public, visually polished portfolio homepage and public project cards/case studies. Seed with clearly identified demo content or editable content configuration; do not invent the owner's personal bio.
- Private `/lab` shell with sidebar/navigation, responsive mobile design, overview, project list, and project detail.
- Supabase Auth integration and real server-side authorization for private API endpoints.
- Project creation, listing, editing, and visibility fields; owner-based access controls.
- Loading, empty, error, and unauthorized states should be designed, not ignored.

### M2 — Universal Run & Artifact Publishing

- DB entities for `projects`, `runs`, `metrics`, `artifacts`, and scoped `agent_credentials` (plus supporting identity/migration tables as required).
- Run API: create, list, detail, finish/fail; status and timestamps.
- Metrics API: record named scalar metrics (optionally step-based) and view them per run.
- Artifact API: register upload, store metadata, finalize/verify, authorize download/preview. Use R2 presigned URLs for cloud when configured; avoid proxying large files through FastAPI. A local adapter may accept uploads in dev.
- Start with **PNG/JPEG, CSV (bounded preview), Markdown and Plotly JSON**. Add Parquet and HTML reports later. Do not render untrusted HTML/JS in the application origin; do not execute arbitrary uploaded code.
- Python SDK with ergonomic usage (`LabClient`, create run, log_metric, log_artifact, complete/fail), timeouts, retries for safe operations, useful error messages, and environment-variable auth.
- A runnable end-to-end example in `workflows/examples/ecommerce_eda/` that produces **actual** sample analyses and uploads them. If no dataset is supplied, generate a small clearly labeled synthetic dataset with fixed seed; do not present it as real commerce findings.
- Private responsive run detail page showing metrics and uploaded images/tables/reports/charts with safe previews and downloads.
- Integration tests for authorization, run creation, artifact lifecycle and retrieval; document a manual smoke test.

**MVP Definition of Done:** A user can sign in, create/open a project, run a documented Python example externally, publish real results, and see them from their phone. Tests pass; remaining cloud credential/domain setup steps are explicit.

## 6. Later phases — DOCUMENT, DO NOT IMPLEMENT UNTIL MVP WORKS

### M3 — Local Agent Runner
- Register/identify local workers, capabilities, heartbeats and outbound HTTPS polling.
- Task templates, authenticated task claiming, state changes, worker logs.
- Never open inbound laptop ports or execute arbitrary user-supplied shell commands.

### M4 — Hybrid Cloud Execution
- Same worker protocol on a VPS/cloud runner.
- Execution policies: `local_only`, `cloud_only`, `local_preferred`, `cloud_preferred`, `any_available`.
- Transactional task leasing, attempt tracking, retries, timeout, stale worker recovery, idempotency, resource limits, and approvals for cost-sensitive jobs.
- Local offline should never break the dashboard. Cloud tasks can run when the laptop is off.

### M5 — Agent Control Center
- Remote task requests, approvals, status monitoring, logs, failure/retry/cancel flow, audit history, notifications if valuable.

### M6 — MLOps & Integrations
- Link MLflow runs; import Airflow/dbt/GitHub Actions results; extend ML/DL experiment comparison, workflow lineage and model tracking.

The MVP schema and APIs should leave room for these phases **without building unnecessary components today**. Capture future ideas in `docs/roadmap.md`.

## 7. Suggested repository structure

```text
vt_dashboard/
├── CLAUDE.md
├── apps/
│   └── web/                    # Next.js
├── services/
│   └── api/                    # FastAPI, models, migrations
├── packages/
│   └── agent_sdk/              # vtcons-lab-sdk
├── workflows/
│   └── examples/
│       └── ecommerce_eda/
├── infra/
│   └── compose/
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   ├── api-contract.md
│   └── setup.md
├── tests/
└── .github/workflows/
```

Adjust folder structure to existing files if the repository already contains relevant implementation. Avoid unnecessary nesting and monorepo tooling just for its own sake.

## 8. Minimum data model and API contract

Start with versioned endpoints under `/v1`.

Data relationships:
- `Project` has many `Run`s.
- `Run` has many `Metric`s and `Artifact`s.
- Each project has an owner and `visibility` (default `private`).
- Each agent credential is hashed/revocable, scoped to projects and minimum permissions; credentials are never exposed after creation.
- Persist `created_at`, `updated_at` and relevant run timestamps; use UTC timestamps.
- Artifacts have `pending_upload`, `ready`, and `failed` states; metadata includes type, MIME, object key, byte size and optional checksum.

Candidate API:

```text
GET    /health/live
GET    /health/ready
GET    /v1/projects
POST   /v1/projects
GET    /v1/projects/{project_id}
PATCH  /v1/projects/{project_id}
GET    /v1/projects/{project_id}/runs
POST   /v1/projects/{project_id}/runs
GET    /v1/runs/{run_id}
POST   /v1/runs/{run_id}/metrics
POST   /v1/runs/{run_id}/complete
POST   /v1/runs/{run_id}/fail
POST   /v1/runs/{run_id}/artifacts/initiate
POST   /v1/artifacts/{artifact_id}/complete
GET    /v1/artifacts/{artifact_id}/download
```

This is a design baseline, not a demand to create dead endpoints. OpenAPI must reflect actual working handlers; make deliberate revisions when appropriate.

## 9. UI/UX direction

Create a distinctive professional interface appropriate for a Data Engineer / AI Engineer portfolio and lab — **not** a generic admin template.

- Clean hierarchy; clear typography, strong spacing, restrained accent color, cohesive light/dark theme if practical.
- Public portfolio should tell a story about engineering work; lab should optimize for scanning project status, runs, metrics and artifacts.
- Mobile-first responsive layout; charts must remain usable on smaller screens.
- Useful states: empty projects, first upload, loading, API errors, unavailable preview, no metrics, auth expired.
- Components should have keyboard accessibility, contrast, semantic headings and sensible responsive behavior.
- Charts should be based on real uploaded data. Demo data must be clearly labeled.
- If relevant local frontend-design/UI skills are installed, inspect and use them; otherwise follow sound frontend design practices. Do not claim a skill was used if it was unavailable.

## 10. Security and reliability rules

- Validate user JWTs and authorize every private resource at the API, not just in the Next.js UI.
- Do not place service-role credentials, private R2 keys, secrets, or agent tokens in browser bundles or git.
- Validate ownership/scopes before issuing presigned upload/download URLs.
- Restrict file size, MIME types, preview limits and metadata. Treat agent-uploaded Markdown/HTML/chart JSON as untrusted input.
- Keep R2 buckets private by default; use short-lived signed URLs where appropriate.
- Use Alembic migrations; never rely on manual database changes as the sole setup procedure.
- Create durable records for runs and artifacts. Preserve failed run history.
- Implement safe timeout and retries for SDK networking; avoid accidental duplicate runs when retrying requests.
- Production endpoints should not permit bypassing authentication via `ENV=development` or a request header.
- Keep local setup pragmatic without weakening deployed security.
- Add integration tests for negative security cases, not only successful flows.

## 11. How Claude Code should work in this repo

1. **Inspect first.** Read README, configs, existing code and this file. Summarize what exists and what is missing. Do not overwrite work without justification.
2. **Create a concise execution plan** in `docs/implementation-plan.md` with ordered tasks, dependencies, acceptance criteria and a checkbox progress tracker.
3. **Implement M0 → M1 → M2 incrementally**, making the system runnable after each milestone rather than generating large untested scaffolds.
4. **Work autonomously on safe local code changes.** Ask only for truly blocking choices, credentials, paid services, external irreversible actions, or destructive operations. If credentials are absent, implement and test using local substitutes/mocks **only where explicitly safe**, document the exact real integration steps, and continue coding.
5. **Run tests and checks**, fix failures, and report actual command results. If tools or services are not available, explain what was not validated; never claim a passing test without executing it.
6. **Keep documentation current**, including setup instructions for macOS (zsh), Docker Compose, required secrets, architecture trade-offs and smoke tests.
7. **Stop after a working M0–M2 MVP** and summarize the result plus the next steps. Do not automatically build M3–M6 or provision cloud resources without approval.
8. **Do not commit secrets or invent personal information.** Exception to production deploys: the owner explicitly permits pushing to `main` (which auto-deploys to Vercel and overwrites the live sites) at any working milestone, so they can see progress early. Only push code that builds; other production changes (DNS, paid services, new cloud resources) still need explicit permission.

### Reporting format after meaningful milestones

Respond in Vietnamese with:
- What was actually implemented, with relevant file paths.
- How to run it locally (exact commands).
- Checks/tests executed and outcomes.
- Any blockers or required credentials (if any).
- Next concrete task.

## 12. First task to perform now

**Begin with repository inspection, then implement the MVP described in M0–M2.** Do not stop after writing a plan. Build the smallest coherent end-to-end product, prioritizing this order:

1. Local runnable web + API + PostgreSQL development environment.
2. Authenticated project registry and private lab UI.
3. Run/metric/artifact APIs and local/cloud-compatible storage abstraction.
4. Python SDK + runnable E-Commerce EDA example.
5. End-to-end UI display and tests.

If deploying requires account access, DNS changes, API tokens or payment, leave deployment unperformed, produce exact setup instructions and identify the blocker. The owner will supply those resources explicitly when ready.

## 13. Sandbox and local environment rules (this Mac / Gyuki)

### Git push / GitHub

This session runs in a sandbox. Only the **standalone** forms of `git push`, `git pull`, `git fetch`, `git ls-remote`, `gh`, `vercel` and `npx playwright` run outside it and get the Keychain login for GitHub/Vercel. If one of them is chained or piped, it runs sandboxed and fails with `fatal: could not read Username for 'https://github.com': Device not configured`.

- Commit in a separate, earlier Bash call (`git add ... && git commit -m ...` is fine).
- Then push with exactly `git push origin main`: no `cd` in front, no `2>&1`, no `| tail`, no `;`, `&&` or `||`.
- Check the result afterwards in another call (`git status -sb`).

### Local servers

Bind every local server to loopback only (`-H 127.0.0.1`, `uvicorn --host 127.0.0.1`, `npx serve -l tcp://127.0.0.1:<port>`; in Docker Compose publish ports as `"127.0.0.1:<host>:<container>"`). Never use `0.0.0.0`, `-H ::` or `--host` without an address. Open pages at `http://127.0.0.1:<port>`.
