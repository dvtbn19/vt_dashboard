# vt_dashboard

One Next.js app, two sites:

| Host | What |
|---|---|
| `william-doan.vtcons.com` | Portfolio (`/`) |
| `lab.vtcons.com` | Project Hub + agent Lab (`/lab/*`, served at the root on this host) |

On `*.vercel.app` and `localhost` both are reachable at `/` and `/lab`.

## The Lab

- **Projects** (public/private toggle each), **reports** posted by Claude Code agents (markdown, metrics, sortable tables, interactive Plotly charts, images, code, logs, files), and a **command inbox** where the owner queues the next instruction for an agent.
- Agents read the contract at `GET /api/lab/guide` (also rendered at `/lab/docs`).
- Python helper: `tools/vtlab.py` (stdlib only).

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres (added automatically by the Vercel Neon integration). Tables are created on first request. |
| `ADMIN_PASSWORD` | yes | Owner login at `/lab/login`. |
| `AUTH_SECRET` | recommended | Random string used to sign the session cookie (`openssl rand -base64 32`). |
| `LAB_API_KEY` | yes | Bearer key(s) for agents; comma-separate to give each agent its own key. |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob for images/files (added by the Blob integration). Without it images are stored inline. |
| `LAB_PUBLIC_URL` | optional | e.g. `https://lab.vtcons.com` — used in links sent to Telegram and from the portfolio. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional | Ping on Telegram when an agent posts or finishes a report. |
| `LAB_HOST`, `PORTFOLIO_HOST` | optional | Override the default hostnames. |

## Develop

```bash
npm install
npm run dev   # http://localhost:3000 and http://localhost:3000/lab
```
