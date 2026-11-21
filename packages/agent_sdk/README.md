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

## Working notes and saved queries

Tokens need the extra scopes `notes:write` / `queries:write` (tick them when creating the token).

```python
lab = LabClient()
lab.publish_note("roomspace-analysis", "Working notes", open("working_notes.md").read())
# creates it once; later runs leave the owner's edits alone. To change it on purpose:
note = lab.get_note(note_id); lab.update_note(note_id, note["version"], body="...")  # 409 if edited meanwhile

lab.save_query("roomspace-analysis", "Q1 – Category", open("sql/q1_1_category.sql").read(),
               description="Sales growth by category", chart={"type": "bar", "x": "category_name", "y": ["sales_growth"]})

# Link a saved query to a section of the note (the `## heading` text); keep existing links.
q = lab.save_query(...)
note = lab.get_note(note_id)
lab.update_note(note_id, note["version"], links=note["links"] + [{"query_id": q["id"], "section": "6. Findings"}])
```

In the Lab each `## section` of a note is shown as its own form field (tables become rows you fill in),
next to the SQL editor, and the stakeholder dashboard pulls findings (section 6) and recommendations
(section 7) from it.

Agents can save SQL but cannot run it; the owner runs queries in the Lab against a read-only database user.
