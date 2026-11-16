"""
vtlab — tiny client for VT Lab (no dependencies beyond the standard library).

    export LAB_URL=https://lab.vtcons.com
    export LAB_API_KEY=...

    from vtlab import Lab
    lab = Lab(agent="eda-bot", project="dottread")
    r = lab.report("Lookup behaviour — first 30 days", kind="eda", summary="...")
    r.metrics({"rows": len(df), "AUROC": 0.912})
    r.markdown("## Findings\n- ...")
    r.table(df.head(200))
    r.plotly(fig)            # plotly figure
    r.image(mpl_fig)         # matplotlib figure
    url = r.publish()        # -> https://lab.vtcons.com/lab/r/<id>

    # long jobs
    r = lab.report("Train LSTM v2", kind="training", status="running"); r.publish()
    for epoch ...: r.append_metrics({"epoch": e, "loss": loss})
    r.finish("done")

    # inbox
    for cmd in lab.inbox(): lab.claim(cmd["id"]); ...

CLI:
    python vtlab.py inbox [--agent NAME]
    python vtlab.py post report.json
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


class LabError(RuntimeError):
    pass


class Lab:
    def __init__(self, agent: str | None = None, project: str | None = None, url: str | None = None, key: str | None = None):
        self.url = (url or os.environ.get("LAB_URL") or "https://lab.vtcons.com").rstrip("/")
        self.key = key or os.environ.get("LAB_API_KEY")
        if not self.key:
            raise LabError("LAB_API_KEY is not set")
        self.agent = agent or os.environ.get("LAB_AGENT")
        self.project = project or os.environ.get("LAB_PROJECT")

    # -- http -------------------------------------------------------------
    def _req(self, method: str, path: str, body: Any = None) -> dict:
        data = None if body is None else json.dumps(body, default=_json_default).encode()
        req = urllib.request.Request(self.url + path, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.key}")
        req.add_header("content-type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.loads(res.read() or b"{}")
        except urllib.error.HTTPError as e:
            raise LabError(f"{method} {path} -> {e.code}: {e.read().decode(errors='replace')}") from None

    # -- reports ----------------------------------------------------------
    def report(self, title: str, *, project: str | None = None, kind: str | None = None, summary: str | None = None,
               status: str = "done", command_id: str | None = None, is_public: bool = False) -> "Report":
        proj = project or self.project
        if not proj:
            raise LabError("project is required (pass project= or set LAB_PROJECT)")
        return Report(self, dict(project=proj, title=title, kind=kind, summary=summary, status=status,
                                 command_id=command_id, is_public=is_public, agent=self.agent))

    # -- inbox ------------------------------------------------------------
    def inbox(self, status: str = "pending", project: str | None = None) -> list[dict]:
        q = f"?status={status}"
        if self.agent:
            q += f"&agent={self.agent}"
        if project or self.project:
            q += f"&project={project or self.project}"
        return self._req("GET", "/api/lab/commands" + q)["commands"]

    def claim(self, command_id: str) -> dict:
        return self._req("PATCH", f"/api/lab/commands/{command_id}", {"status": "claimed", "agent": self.agent})["command"]

    def reply(self, command_id: str, response: str, status: str = "done") -> dict:
        return self._req("PATCH", f"/api/lab/commands/{command_id}", {"status": status, "response": response})["command"]

    # -- projects ---------------------------------------------------------
    def upsert_project(self, slug: str, **fields) -> dict:
        return self._req("POST", "/api/lab/projects", {"slug": slug, **fields})["project"]


class Report:
    def __init__(self, lab: Lab, meta: dict):
        self.lab = lab
        self.meta = {k: v for k, v in meta.items() if v is not None}
        self.blocks: list[dict] = []
        self.id: str | None = None
        self.url: str | None = None

    # block builders (chainable)
    def markdown(self, text: str): return self._add({"type": "markdown", "content": text})
    def code(self, text: str, language: str = "python"): return self._add({"type": "code", "content": text, "language": language})
    def log(self, text: str): return self._add({"type": "log", "content": text})
    def file(self, url: str, name: str): return self._add({"type": "file", "url": url, "name": name})

    def metrics(self, items: dict | list):
        if isinstance(items, dict):
            items = [{"label": k, "value": _scalar(v)} for k, v in items.items()]
        return self._add({"type": "metrics", "items": items})

    def table(self, df_or_rows, columns: list[str] | None = None, caption: str | None = None, max_rows: int = 2000):
        if hasattr(df_or_rows, "to_dict"):  # pandas
            df = df_or_rows.head(max_rows)
            if getattr(df.index, "name", None) or not _is_range_index(df):
                df = df.reset_index()
            cols = [str(c) for c in df.columns]
            rows = [[_scalar(v) for v in r] for r in df.itertuples(index=False, name=None)]
        else:
            cols, rows = columns or [], [[_scalar(v) for v in r] for r in list(df_or_rows)[:max_rows]]
        return self._add({"type": "table", "columns": cols, "rows": rows, "caption": caption})

    def plotly(self, fig, caption: str | None = None):
        figure = json.loads(fig.to_json()) if hasattr(fig, "to_json") else fig
        return self._add({"type": "plotly", "figure": figure, "caption": caption})

    def image(self, fig_or_bytes, caption: str | None = None, mime: str = "image/png"):
        if hasattr(fig_or_bytes, "savefig"):
            buf = io.BytesIO()
            fig_or_bytes.savefig(buf, format="png", dpi=144, bbox_inches="tight")
            data = buf.getvalue()
        elif isinstance(fig_or_bytes, (bytes, bytearray)):
            data = bytes(fig_or_bytes)
        else:
            with open(fig_or_bytes, "rb") as fh:
                data = fh.read()
        return self._add({"type": "image", "data": base64.b64encode(data).decode(), "mime": mime, "caption": caption})

    def _add(self, block: dict):
        block = {k: v for k, v in block.items() if v is not None}
        if self.id:  # already published → stream it
            self.lab._req("PATCH", f"/api/lab/reports/{self.id}", {"append_blocks": [block]})
        else:
            self.blocks.append(block)
        return self

    # lifecycle
    def publish(self) -> str:
        res = self.lab._req("POST", "/api/lab/reports", {**self.meta, "blocks": self.blocks})["report"]
        self.id, self.url = res["id"], res["url"]
        self.blocks = []
        return self.url

    def append_metrics(self, items: dict | list):
        return self.metrics(items)

    def finish(self, status: str = "done", summary: str | None = None) -> str:
        body = {"status": status}
        if summary:
            body["summary"] = summary
        self.lab._req("PATCH", f"/api/lab/reports/{self.id}", body)
        return self.url or ""


def _is_range_index(df) -> bool:
    try:
        import pandas as pd  # noqa: F401
        return df.index.__class__.__name__ == "RangeIndex"
    except Exception:
        return True


def _scalar(v):
    if v is None:
        return None
    if hasattr(v, "item"):
        try:
            v = v.item()
        except Exception:
            pass
    if isinstance(v, float) and v != v:  # NaN
        return None
    if isinstance(v, (int, float, str)):
        return v
    return str(v)


def _json_default(o):
    if hasattr(o, "item"):
        return o.item()
    if hasattr(o, "isoformat"):
        return o.isoformat()
    return str(o)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    agent = None
    if "--agent" in args:
        i = args.index("--agent")
        agent = args[i + 1]
        del args[i:i + 2]
    lab = Lab(agent=agent)
    if args[0] == "inbox":
        print(json.dumps(lab.inbox(), indent=2, ensure_ascii=False))
    elif args[0] == "post" and len(args) > 1:
        with open(args[1]) as fh:
            print(json.dumps(lab._req("POST", "/api/lab/reports", json.load(fh)), indent=2))
    else:
        print(__doc__)
        sys.exit(1)
