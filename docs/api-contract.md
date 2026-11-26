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
| GET | `/v1/projects/{id}/notes` | user, agent `read` | list (no bodies), newest first |
| POST | `/v1/projects/{id}/notes` | user, agent `notes:write` | `{title, body, links?}` (Markdown); honours `Idempotency-Key` |
| GET | `/v1/notes/{id}` | user, agent `read` | includes `body`, `version`, `last_edited_by` |
| PATCH | `/v1/notes/{id}` | user, agent `notes:write` | `{base_version, title?, body?, links?}`; **409** `{message, current_version}` if it changed since `base_version` |
| DELETE | `/v1/notes/{id}` | user | |

Notes carry `links: [{query_id, section}]`: the saved queries a note relies on, each tied to one
`## section` heading (or `""` for the whole note). Links to queries outside the note's project are
dropped silently; deleting a query removes it from every note's links (without a version bump).
The Lab edits a note as a form: each `## section` is a field group and Markdown tables become rows.
| GET | `/v1/projects/{id}/queries` | user, agent `read` | saved queries incl. `sql` and `chart` |
| POST | `/v1/projects/{id}/queries` | user, agent `queries:write` | `{name, sql, description?, chart?}`; `chart = {type: bar\|line\|scatter, x, y:[…]}`; 409 on duplicate name |
| GET / PATCH / DELETE | `/v1/queries/{id}` | read / `queries:write` / user | PATCH needs `base_version` (409 as for notes); `chart: null` clears it |

A query's `chart`: `{type: bar|hbar|line|area|scatter, x, y: [measures]}` plus optional `agg` (sum|avg|min|max|count|none; absent = every row), `color` (column, one hue per value; past 8 values the smallest fold into "Other"), `facet` (column or `@measures`: one small chart each), `barmode` (group|stack|percent), `sort` (none|desc|asc), `filters` (`[{column, values}]`, keep rows whose value is listed). Stored and returned exactly as sent.
| GET | `/v1/queries/engine` | user | `{configured, timeout_seconds, max_rows}` |
| POST | `/v1/queries/run` | **user only** | `{sql, max_rows≤5000}` → `{columns, rows, row_count, truncated, elapsed_ms}`; 400 with the database message; 503 if `ANALYTICS_DATABASE_URL` is unset |
| POST | `/v1/queries/{id}/run?max_rows=` | **user only** | runs a saved query; if its SQL holds several statements (the editor runs one at a time, at the cursor or selection), the first one runs |
| GET | `/v1/projects/{id}/notebook` | user, agent `read` | the workspace notebook: `{cells, version, last_edited_by, updated_at}`; `version: 0` and `cells: []` when none saved yet |
| PUT | `/v1/projects/{id}/notebook` | user, agent `queries:write` | `{base_version, cells}` replaces the cell order (`base_version: 0` creates it); **409** `{message, current_version}` if it changed |
| GET | `/v1/public/projects`, `/v1/public/projects/{slug}` | anyone | only `visibility=public`; no ids, runs or files |

Notebook `cells` (max 500): `{type: "sql", query_id}` (a saved query of the project, which holds the
SQL and chart) or `{type: "markdown", id, text}` (`id` matches `[A-Za-z0-9_-]{1,64}`; `#` headings make
the Lab's table of contents). Unknown or repeated query ids are dropped; deleted queries disappear on
read. Saved queries missing from `cells` are shown after them, in creation order.

Artifact states: `pending_upload → ready | failed`. Run states: `running → completed | failed`.

### Running SQL (analytics queries)

Queries run against `ANALYTICS_DATABASE_URL`, a database separate from the Lab's own metadata, using a
**read-only role** (e.g. Supabase `team_ro`, SELECT on one schema). On top of that the API wraps the
statement as `SELECT * FROM (<sql>) AS lab_query LIMIT n` (so only a single query can run), inside a
`READ ONLY` transaction with `statement_timeout` (`QUERY_TIMEOUT_SECONDS`, default 20) that is always
rolled back, and caps rows (`QUERY_MAX_ROWS`, default 5000) and cell size. Agent tokens can save SQL
but never run it. Notes and saved queries use optimistic concurrency (`version` / `base_version`).
