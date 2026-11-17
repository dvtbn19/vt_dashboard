# Roadmap (after the M0–M2 MVP)

Documented, not implemented. Each phase needs the owner's go-ahead.

## Near-term polish
- Parquet artifacts (bounded preview via pyarrow) and sandboxed HTML reports served from a separate origin.
- Run comparison: metrics side by side across runs of a project.
- Delete/archive for projects and runs (soft delete, keep audit trail).
- Clean-up job for artifacts stuck in `pending_upload`.
- Rate limiting on auth and upload endpoints.

## M3 — Local agent runner
- `workers` table: id, name, capabilities, last heartbeat; registered with a worker-scoped token (`tasks:claim`).
- Outbound HTTPS polling only; no inbound ports on the laptop.
- `task_templates` (pre-approved commands with typed parameters) — never arbitrary shell from the dashboard.
- Task claim/state transitions with leases; worker logs streamed as artifacts.

## M4 — Hybrid cloud execution
- Same protocol on a VPS/cloud runner.
- Execution policy per task: `local_only`, `cloud_only`, `local_preferred`, `cloud_preferred`, `any_available`.
- Transactional leasing (`SELECT … FOR UPDATE SKIP LOCKED`), attempts, retries, timeouts, stale-worker recovery, resource limits.
- Approval gate for cost-sensitive jobs; no automatic paid GPU provisioning.

## M5 — Agent control center
- Task requests from the phone, approvals, live status, logs, cancel/retry, audit history, optional Telegram notifications.

## M6 — MLOps & integrations
- Link MLflow runs; import Airflow/dbt/GitHub Actions results as runs; lineage and model registry views.
