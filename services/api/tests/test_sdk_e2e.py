"""End-to-end: the real SDK talking to the real API (in-process transport), local storage adapter."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_token

vtcons_lab = pytest.importorskip("vtcons_lab")


def test_sdk_publishes_run(client: TestClient, owner, project, tmp_path):
    token = make_token(client, owner, [project["id"]])
    lab = vtcons_lab.LabClient("http://testserver", token, transport=client._transport, backoff=0)

    (tmp_path / "preview.csv").write_text("a,b\n1,2\n3,4\n")
    (tmp_path / "report.md").write_text("# EDA\n\nSynthetic data.")
    (tmp_path / "chart.json").write_text(
        json.dumps({"data": [{"type": "scatter", "y": [1, 2]}], "layout": {}})
    )

    with lab.start_run(project["slug"], "sdk-e2e", params={"seed": 7}, tags=["test"]) as run:
        run.log_metrics({"rows": 2, "revenue_total": 10.5})
        run.log_metric("loss", 0.4, step=1)
        for name in ("preview.csv", "report.md", "chart.json"):
            assert run.log_artifact(tmp_path / name)["status"] == "ready"

    detail = client.get(f"/v1/runs/{run.id}", headers=owner).json()
    assert detail["status"] == "completed"
    assert detail["params"] == {"seed": 7}
    assert {m["key"] for m in detail["metrics"]} == {"rows", "revenue_total", "loss"}
    assert sorted(a["kind"] for a in detail["artifacts"]) == ["csv", "markdown", "plotly"]


def test_sdk_marks_failed_run(client: TestClient, owner, project):
    token = make_token(client, owner, [project["id"]])
    lab = vtcons_lab.LabClient("http://testserver", token, transport=client._transport, backoff=0)
    with pytest.raises(ZeroDivisionError):
        with lab.start_run(project["id"], "will-fail") as run:
            1 / 0  # noqa: B018
    detail = client.get(f"/v1/runs/{run.id}", headers=owner).json()
    assert detail["status"] == "failed" and "ZeroDivisionError" in detail["error"]


def test_sdk_notes_and_queries(client: TestClient, owner, project):
    scopes = ["read", "notes:write", "queries:write"]
    token = make_token(client, owner, [project["id"]], scopes=scopes)
    lab = vtcons_lab.LabClient("http://testserver", token, transport=client._transport, backoff=0)

    note = lab.publish_note(project["slug"], "Working notes", "# v1")
    # The owner edits it in the Lab...
    r = client.patch(
        f"/v1/notes/{note['id']}", json={"base_version": 1, "body": "# owner edit"}, headers=owner
    )
    assert r.status_code == 200
    # ...so publishing again must not overwrite, and a stale update is refused.
    again = lab.publish_note(project["slug"], "Working notes", "# v1 again")
    assert again["id"] == note["id"] and again["body"] == "# owner edit"
    with pytest.raises(vtcons_lab.LabError) as exc:
        lab.update_note(note["id"], 1, body="stale")
    assert exc.value.status == 409

    chart = {"type": "bar", "x": "a", "y": ["b"]}
    q1 = lab.save_query(project["slug"], "Q1", "select 1 as a, 2 as b", chart=chart)
    same = lab.save_query(project["slug"], "Q1", "select 1 as a, 2 as b", chart=chart)
    assert same["version"] == q1["version"] == 1
    changed = lab.save_query(project["slug"], "Q1", "select 1 as a, 3 as b", chart=chart)
    assert changed["id"] == q1["id"] and changed["version"] == 2
    assert [q["name"] for q in lab.list_queries(project["slug"])] == ["Q1"]
