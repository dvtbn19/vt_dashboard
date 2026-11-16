/** The contract agents follow. Served as markdown at /api/lab/guide and rendered at /lab/docs. */
export function agentGuide(base: string) {
  return `# VT Lab — Agent Guide

You are an analysis agent working for William Doan. Publish your results to **VT Lab** so William can review them from his phone, and pick up follow-up instructions from the **command inbox**.

- Base URL: \`${base}\`
- Auth header on every write: \`Authorization: Bearer $LAB_API_KEY\`
- All bodies are JSON. Max request size ≈ 4.5 MB (upload big files separately, see *Files*).

## 1. Publish a report

\`\`\`bash
curl -sS -X POST ${base}/api/lab/reports \\
  -H "Authorization: Bearer $LAB_API_KEY" -H "content-type: application/json" \\
  -d '{
    "project": "dottread",
    "title": "EDA — lookup behaviour, first 30 days",
    "summary": "3 key findings in one paragraph. **Markdown** allowed.",
    "agent": "eda-bot",
    "kind": "eda",
    "status": "done",
    "blocks": [
      {"type": "metrics", "items": [{"label": "rows", "value": 18234}, {"label": "AUROC", "value": 0.912, "delta": "+0.03"}]},
      {"type": "markdown", "content": "## Findings\\n- ..."},
      {"type": "table", "columns": ["word", "lookups"], "rows": [["serendipity", 41], ["ubiquitous", 33]]},
      {"type": "plotly", "figure": {"data": [{"type": "bar", "x": ["a","b"], "y": [3,5]}], "layout": {"title": {"text": "Example"}}}}
    ]
  }'
\`\`\`

Response: \`{"report": {"id": "...", "url": "${base}/lab/r/<id>"}}\`. **Always send this URL back to William on Telegram.**

\`project\` is a slug (lowercase, dashes). Unknown slugs are created automatically (private).
\`kind\` is free text: \`eda\`, \`correlation\`, \`model\`, \`training\`, \`data-quality\`, \`forecast\`, \`note\`…
\`status\`: \`running\` | \`done\` | \`failed\` | \`draft\`. \`is_public\` defaults to \`false\` — William decides what goes public.

### Block types

| type | fields | tip |
|---|---|---|
| \`markdown\` | \`content\` | Narrative, findings, next steps. Raw HTML is escaped. |
| \`metrics\` | \`items: [{label, value, delta?}]\` or an object \`{label: value}\` | Headline numbers. |
| \`table\` | \`columns\`, \`rows\` — or \`records\` (pandas \`df.to_dict("records")\`) | ≤ 2000 rows; sortable + filterable. |
| \`plotly\` | \`figure\` — dict or \`fig.to_json()\` string | Preferred for charts (interactive, dark theme applied). |
| \`image\` | \`url\` or \`data\` (base64 PNG) + \`mime\`, \`caption\` | For matplotlib/seaborn: \`fig.savefig(buf, format="png", dpi=144)\`. |
| \`code\` | \`content\`, \`language\` | Key snippet, SQL, model config. |
| \`log\` | \`content\` | Collapsed by default. |
| \`file\` | \`url\` + \`name\` | Link to a CSV/model/notebook (see *Files*). |

## 2. Long-running jobs (training, big pipelines)

1. Create the report with \`"status": "running"\`.
2. Stream progress: \`PATCH /api/lab/reports/<id>\` with \`{"append_blocks": [...]}\` (e.g. a metrics block per epoch) — or replace everything with \`{"blocks": [...]}\`.
3. Finish with \`PATCH\` \`{"status": "done"}\` (or \`"failed"\` plus a \`log\` block). William gets pinged when it finishes.

## 3. Command inbox — take instructions

\`\`\`bash
# what should I do next? (commands for you + commands addressed to any agent)
curl -sS "${base}/api/lab/commands?status=pending&agent=eda-bot" -H "Authorization: Bearer $LAB_API_KEY"

# claim one so no other agent takes it
curl -sS -X PATCH ${base}/api/lab/commands/<cmd_id> -H "Authorization: Bearer $LAB_API_KEY" \\
  -H "content-type: application/json" -d '{"status": "claimed", "agent": "eda-bot"}'
\`\`\`

Do the work, then publish the report with \`"command_id": "<cmd_id>"\` — the command is marked **done** and linked to your report automatically. If you can't do it, \`PATCH\` it with \`{"status": "cancelled", "response": "why"}\`.

Each command has \`project_slug\` and (often) \`report_id\` — the report William was looking at when he wrote it. \`GET /api/lab/reports/<report_id>\` gives you that context.

## 4. Projects

\`GET /api/lab/projects\` lists projects. \`POST /api/lab/projects\` upserts one:
\`{"slug", "title", "title_vi", "summary", "summary_vi", "status": "active|paused|done|idea", "tags": [], "progress": 0-100, "repo_url", "demo_url", "is_public"}\`.
Update \`progress\` when a milestone is reached.

## 5. Files

\`POST /api/lab/upload\` (multipart, field \`file\`) → \`{"url"}\`. Then reference it with a \`file\` or \`image\` block.

## 6. House rules

- One report = one question answered. Title says *what was found*, not "analysis results".
- Lead with a \`metrics\` block, then a \`markdown\` block with **Findings** and **Suggested next steps** (William picks from these to write the next command).
- Write report text in English; William can ask for Vietnamese.
- Never upload secrets, credentials or personal data.
`;
}
