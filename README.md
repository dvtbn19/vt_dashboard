# VTCONS Project Lab

Personal portfolio + private data/AI project lab. Scripts and agents publish runs, metrics and files through an authenticated API; the owner reviews them in a mobile-friendly dashboard.

```
apps/web/                 Next.js: public portfolio (/, /projects) and private lab (/lab)
services/api/             FastAPI + SQLAlchemy + Alembic: /v1 API, auth, storage abstraction
packages/agent_sdk/       vtcons-lab-sdk (Python): LabClient, runs, metrics, artifacts
workflows/examples/       ecommerce_eda: synthetic-data EDA that publishes real outputs
infra/compose/            PostgreSQL for local development
docs/                     architecture, API contract, setup + smoke test, deployment, roadmap, plan
```

Quick start: see [docs/setup.md](docs/setup.md). Publishing from Python:

```python
from vtcons_lab import LabClient

with LabClient().start_run("ecommerce-sales-analysis", name="eda", params={"seed": 42}) as run:
    run.log_metrics({"rows": 5000})
    run.log_artifact("correlation.png")
```

Design notes: [DESIGN.md](DESIGN.md). Project rules for coding agents: [CLAUDE.md](CLAUDE.md).
