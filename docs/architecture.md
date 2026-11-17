# Architecture

```
                         ┌──────────────── control plane (always on) ────────────────┐
 Browser (phone/laptop)  │                                                           │
   │  HTTPS              │  Next.js (apps/web)          FastAPI (services/api)        │
   ├────────────────────▶│  portfolio + /lab  ──JWT──▶  /v1 business logic + authZ   │
   │                     │  server components           │            │               │
   │                     │                              ▼            ▼               │
   │                     │                      PostgreSQL     Object storage        │
   │                     │                      (metadata)     (R2 / local disk)     │
   │                     └──────────────────────────────────────────▲────────────────┘
   │  signed GET URL (images, downloads) ───────────────────────────┤
 Python script / agent ──vtcons-lab-sdk──▶ FastAPI ── presigned PUT ┘   (execution plane: laptop, CI, cloud)
```

## Responsibilities

| Part | Owns | Never does |
|---|---|---|
| `apps/web` (Next.js App Router) | Presentation, sign-in UI, forms (server actions), safe rendering of previews | Authorisation decisions, holding service-role keys, rendering uploaded HTML |
| `services/api` (FastAPI) | Auth verification, ownership/scope checks, run/metric/artifact lifecycle, signed URLs, bounded previews | Proxying large files (except the dev-only local storage adapter) |
| PostgreSQL | `users`, `projects`, `runs`, `metrics`, `artifacts`, `agent_credentials`, `idempotency_records` | Storing file bytes |
| Object storage | Artifact bytes under `projects/{project}/runs/{run}/{artifact}/{name}` | Public access (bucket stays private) |
| `packages/agent_sdk` | Ergonomic publishing, retries, timeouts | Talking to the DB or storage credentials directly |

## Key decisions and trade-offs

- **Auth.** Humans sign in with Supabase Auth; the API verifies the JWT itself (JWKS for asymmetric keys, or the legacy HS256 secret) and checks an e-mail allow-list. Agents use `vtl_…` tokens: SHA-256 hashed at rest, scoped to projects + permissions (`read`, `runs:write`, `artifacts:write`), expiring and revocable. A dev-only `AUTH_MODE=local` issues HS256 tokens for local work; settings validation refuses it when `ENV=production`, so there is no production bypass.
- **Ownership checks return 404, not 403**, so other users' resource ids cannot be probed.
- **Uploads go straight to storage** with presigned PUT URLs (R2) or HMAC-signed URLs (local adapter, same contract). `complete` then verifies size, optional SHA-256, magic bytes (PNG/JPEG), UTF-8 (CSV/Markdown) and Plotly JSON shape before marking `ready`; failures are kept as `failed` with a reason.
- **Untrusted content.** Markdown is rendered without raw HTML and with images turned into links; Plotly figures are reduced to `data` + `layout` minus `images`/`template`; CSV previews are bounded (rows, columns, cell length, bytes). Downloads of non-images are `attachment`; the local adapter adds `nosniff` and a sandbox CSP. Nothing uploaded is served from the web app's origin.
- **Idempotency.** `POST` endpoints that create things accept `Idempotency-Key`. The stored response is written in the same transaction as the created rows, so SDK retries never duplicate runs, metric batches or artifacts. `complete`/`fail` are naturally idempotent.
- **Reproducibility.** Runs are never overwritten; failed runs keep their error. Runs record params, tags, git commit (auto-detected by the SDK), dataset version, timestamps and who published them.
- **Single Next.js app** serves the portfolio and the lab; subdomains can point at the same deployment later. Public pages fetch only `/v1/public/*` (projects explicitly marked public; runs and files are never public).
- **UI primitives are hand-written with Tailwind** instead of pulling in shadcn/ui + Radix: the MVP needs a handful of components (button, field, status, sheet) and no complex widgets yet. shadcn can be added when dialogs/menus are needed.
- **Charts:** Plotly only (uploaded figures are Plotly JSON). Metrics use a tiny SVG sparkline; ECharts is not added.
- **SQLite support** exists only so tests and quick local tries run without Docker; PostgreSQL is the target (CI runs the suite on both).

## Room for M3–M6

`runs.source`, `params` and `tags` already describe where work came from; credential scopes are a list, so worker scopes such as `tasks:claim` can be added; idempotency records are generic. See `docs/roadmap.md`.
