# Setup (macOS, zsh)

Requirements: Python 3.11+ (Homebrew `python3.13` works), Node 22, Docker Desktop (for PostgreSQL).

## 1. Database

```zsh
docker compose -f infra/compose/docker-compose.yml up -d     # PostgreSQL on 127.0.0.1:5432
```

No Docker? For a quick try, set `DATABASE_URL=sqlite:///./data/dev.db` in `services/api/.env` (tests use SQLite too). PostgreSQL is the supported target.

## 2. API

```zsh
cd services/api
python3.13 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env            # then edit: secrets (python3 -c "import secrets;print(secrets.token_urlsafe(40))"), LOCAL_LOGIN_PASSWORD, LAB_ALLOWED_EMAILS
mkdir -p data
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
curl http://127.0.0.1:8000/health/ready
```

## 3. Web

```zsh
cd apps/web
npm install
cp .env.example .env.local      # API_URL=http://127.0.0.1:8000, LAB_AUTH_MODE=local
npm run dev                     # http://127.0.0.1:3000 and http://127.0.0.1:3000/lab
```

To open the lab from a phone on the same Wi-Fi you would have to bind to your LAN address; that is deliberately not the default. Use the deployed site (see `deployment.md`) for phone access.

## 4. SDK + example

```zsh
cd workflows/examples/ecommerce_eda
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python run_eda.py --no-publish        # only writes ./out
```

macOS note: if `import vtcons_lab` fails after `pip install -e`, the editable `.pth` file was flagged hidden (Python 3.13 skips hidden `.pth` files). Install non-editable instead (`pip install ../../../packages/agent_sdk`) or run `chflags nohidden .venv/lib/python3.*/site-packages/*.pth`.

## 5. Manual smoke test (end to end)

1. Open `http://127.0.0.1:3000/lab` → redirected to sign-in. Try a wrong password: “Wrong e-mail or password.” Sign in with `LOCAL_LOGIN_EMAIL` / `LOCAL_LOGIN_PASSWORD`.
2. Overview shows zeros and “Publish your first results”.
3. **New project** → name “E-Commerce Sales Analysis”, slug `ecommerce-sales-analysis` → project page with “No runs yet”.
4. **Agent tokens** → name `laptop-eda`, tick the project → copy the token shown once.
5. Publish:
   ```zsh
   export VTCONS_LAB_URL=http://127.0.0.1:8000
   export VTCONS_LAB_TOKEN=vtl_...
   workflows/examples/ecommerce_eda/.venv/bin/python workflows/examples/ecommerce_eda/run_eda.py
   ```
   Prints `Published run <id>`.
6. Open the run (Overview → Recent runs): status Completed, 8 metrics, correlation heatmap, Plotly revenue chart, Markdown report (yellow “Synthetic data” note), CSV table (first 50 rows). **Download** works for each file.
7. Narrow the browser to phone width: bottom tab bar, no horizontal page scroll.
8. Revoke the token in **Agent tokens**, rerun step 5 → `401 … Agent token has been revoked`.
9. Edit the project → Visibility “Public on portfolio” → it appears on `/projects` (runs and files stay private).

Alternative to steps 3–4 from the command line: `cd services/api && .venv/bin/python -m app.cli bootstrap --email owner@example.com --project-slug ecommerce-sales-analysis --project-name "E-Commerce Sales Analysis"`.

## 6. Checks

```zsh
cd services/api && .venv/bin/ruff check app tests alembic && .venv/bin/mypy && .venv/bin/pytest
TEST_DATABASE_URL=postgresql+psycopg://vtlab:vtlab@127.0.0.1:5432/vtlab_test .venv/bin/pytest   # needs: createdb vtlab_test
cd packages/agent_sdk && ../../services/api/.venv/bin/pytest
cd apps/web && npm run lint && npm run typecheck && npm run build
```
