# vtcons-lab-sdk

Publish runs, metrics and artifacts from any Python script to VTCONS Project Lab.

```bash
pip install -e packages/agent_sdk          # from the repo root
export VTCONS_LAB_URL=http://127.0.0.1:8000
export VTCONS_LAB_TOKEN=vtl_...             # Lab → Settings → Agent tokens
```

```python
from vtcons_lab import LabClient

lab = LabClient()
with lab.start_run("ecommerce-sales-analysis", name="weekly-eda", params={"seed": 42}) as run:
    run.log_metrics({"rows": 5000, "revenue_total": 1.2e6})
    run.log_metric("loss", 0.31, step=10)
    run.log_artifact("correlation.png", description="Pearson correlation of numeric columns")
    run.log_artifact("report.md")
    run.log_artifact("revenue_by_month.json")   # a Plotly figure as JSON
# completed on exit; on an exception the run is marked failed with the traceback, then the error re-raises
```

Supported artifact types: `.png`, `.jpg/.jpeg`, `.csv`, `.md`, `.json` (Plotly figure: `{"data": [...], "layout": {...}}`).

Behaviour:
- Timeouts on every request (30 s API, 300 s uploads).
- Retries with exponential backoff on network errors and 429/502/503/504, **only** for operations that
  are safe to repeat: reads, run/artifact completion, signed-URL uploads, and creates that carry an
  `Idempotency-Key` (run creation, metric batches, artifact registration). A retried create never duplicates.
- The bearer token is never sent to presigned upload URLs.
- Errors raise `LabError` with the HTTP status, the server's message and a hint.
- The current git commit (if any) is recorded on the run automatically.
