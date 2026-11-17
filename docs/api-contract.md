# API contract (v1)

Interactive docs: `http://127.0.0.1:8000/docs` (disabled when `ENV=production`). This list matches the implemented handlers.

Auth header: `Authorization: Bearer <token>` — a user JWT (Supabase, or local dev) or an agent token `vtl_…`.
"User only" endpoints reject agent tokens with 403. Resources of other owners, or outside an agent token's project scope, return 404.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/health/live` | anyone | process up |
| GET | `/health/ready` | anyone | 200 if DB (migrated) + storage reachable, else 503 |
| GET | `/v1/me` | user, agent | identity and scopes |
| POST | `/v1/auth/local-login` | anyone | **dev only** (`AUTH_MODE=local`); 404 otherwise |
| GET | `/v1/projects?slug=` | user, agent `read` | agents see only scoped projects; includes run counts |
| POST | `/v1/projects` | user | slug optional (generated), 409 if taken |
| GET | `/v1/projects/{id}` | user, agent `read` | |
| PATCH | `/v1/projects/{id}` | user | name, summary, description (Markdown), category, status, visibility, tags, repo_url |
| GET | `/v1/projects/{id}/runs?limit=` | user, agent `read` | newest first |
| POST | `/v1/projects/{id}/runs` | user, agent `runs:write` | `Idempotency-Key` supported |
| GET | `/v1/runs/{id}` | user, agent `read` | run + project + metrics + artifacts |
| POST | `/v1/runs/{id}/metrics` | user, agent `runs:write` | `{"metrics":[{"key","value","step?"}]}`, ≤1000 per call, finite values, run must be `running`; `Idempotency-Key` supported |
| POST | `/v1/runs/{id}/complete` | user, agent `runs:write` | idempotent; 409 if already failed |
| POST | `/v1/runs/{id}/fail` | user, agent `runs:write` | `{"error": "..."}`; idempotent; 409 if already completed |
| GET | `/v1/overview` | user | counts + recent runs |
| POST | `/v1/runs/{id}/artifacts/initiate` | user, agent `artifacts:write` | `{name, mime_type, size_bytes, kind?, checksum_sha256?, description?}` → `{artifact, upload:{method,url,headers,expires_at}}`. Allowed: `image/png`, `image/jpeg`, `text/csv`, `text/markdown`, `application/json` / `application/vnd.plotly.v1+json` (Plotly). 415 / 413 on type / size |
| (PUT) | `upload.url` | holder of the signed URL | send exactly `upload.headers`; no bearer token |
| POST | `/v1/artifacts/{id}/complete` | user, agent `artifacts:write` | verifies → `ready`, or `failed` + 422 with reason; 409 if not uploaded yet |
| GET | `/v1/artifacts/{id}` | user, agent `read` | metadata |
| GET | `/v1/artifacts/{id}/download` | user, agent `read` | short-lived signed URL; non-images are attachments |
| GET | `/v1/artifacts/{id}/preview?rows=` | user, agent `read` | bounded parsed preview: CSV columns/rows, Markdown text, sanitised Plotly figure, or image URL |
| GET | `/v1/credentials` | user | never returns secrets |
| POST | `/v1/credentials` | user | `{name, project_ids:[uuid…] or ["*"], scopes, expires_in_days}` → includes `token` **once** |
| POST | `/v1/credentials/{id}/revoke` | user | |
| GET | `/v1/public/projects`, `/v1/public/projects/{slug}` | anyone | only `visibility=public`; no ids, runs or files |

Artifact states: `pending_upload → ready | failed`. Run states: `running → completed | failed`.
