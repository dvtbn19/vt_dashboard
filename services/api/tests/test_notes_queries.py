"""Working notes, saved queries and read-only SQL execution."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from tests.conftest import bearer, make_token


@pytest.fixture(scope="module")
def analytics_table(app, env) -> str:
    """A small table in the analytics database."""
    eng = create_engine(env["ANALYTICS_DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://"))
    with eng.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS demo_sales"))
        conn.execute(text("CREATE TABLE demo_sales (store TEXT, month TEXT, sales NUMERIC)"))
        for i in range(120):
            conn.execute(
                text("INSERT INTO demo_sales VALUES (:s, :m, :v)"),
                {"s": f"S{i % 3}", "m": f"2026-{(i % 12) + 1:02d}", "v": 100 + i * 1.5},
            )
    eng.dispose()
    return "demo_sales"


# --- notes -----------------------------------------------------------------------------


def test_note_lifecycle_and_conflict(client: TestClient, owner, project):
    pid = project["id"]
    r = client.post(
        f"/v1/projects/{pid}/notes", json={"title": "Working notes", "body": "# Hi"}, headers=owner
    )
    assert r.status_code == 201, r.text
    note = r.json()
    assert note["version"] == 1 and note["last_edited_by"] == "owner@example.com"

    listed = client.get(f"/v1/projects/{pid}/notes", headers=owner).json()
    assert [n["id"] for n in listed] == [note["id"]] and "body" not in listed[0]

    r = client.patch(
        f"/v1/notes/{note['id']}", json={"base_version": 1, "body": "# Hi\n\nmore"}, headers=owner
    )
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["body"].endswith("more")

    # A second editor still on version 1 must not overwrite.
    r = client.patch(f"/v1/notes/{note['id']}", json={"base_version": 1, "body": "stale"}, headers=owner)
    assert r.status_code == 409
    assert r.json()["detail"]["current_version"] == 2
    assert client.get(f"/v1/notes/{note['id']}", headers=owner).json()["body"].endswith("more")


def test_note_access_control(client: TestClient, owner, other, project):
    pid = project["id"]
    note = client.post(f"/v1/projects/{pid}/notes", json={"title": "Private"}, headers=owner).json()
    assert client.get(f"/v1/notes/{note['id']}", headers=other).status_code == 404
    assert (
        client.patch(
            f"/v1/notes/{note['id']}", json={"base_version": 1, "body": "x"}, headers=other
        ).status_code
        == 404
    )
    assert client.delete(f"/v1/notes/{note['id']}", headers=other).status_code == 404
    assert client.get(f"/v1/projects/{pid}/notes", headers=other).status_code == 404
    assert client.post(f"/v1/projects/{pid}/notes", json={"title": "x"}, headers=other).status_code == 404


def test_agent_notes_need_scope_and_cannot_delete(client: TestClient, owner, project):
    pid = project["id"]
    plain = make_token(client, owner, [pid])  # default scopes: no notes:write
    assert (
        client.post(f"/v1/projects/{pid}/notes", json={"title": "x"}, headers=bearer(plain)).status_code
        == 403
    )
    assert client.get(f"/v1/projects/{pid}/notes", headers=bearer(plain)).status_code == 200

    tok = make_token(client, owner, [pid], scopes=["read", "notes:write"])
    h = {**bearer(tok), "Idempotency-Key": "note-1"}
    r1 = client.post(f"/v1/projects/{pid}/notes", json={"title": "From agent", "body": "a"}, headers=h)
    r2 = client.post(f"/v1/projects/{pid}/notes", json={"title": "From agent", "body": "a"}, headers=h)
    assert r1.status_code == 201 and r2.status_code == 201 and r1.json()["id"] == r2.json()["id"]
    assert r1.json()["last_edited_by"] == "agent:test-agent"
    assert client.delete(f"/v1/notes/{r1.json()['id']}", headers=bearer(tok)).status_code == 403
    assert client.delete(f"/v1/notes/{r1.json()['id']}", headers=owner).status_code == 204
    assert client.get(f"/v1/notes/{r1.json()['id']}", headers=owner).status_code == 404


def test_agent_scoped_to_other_project_cannot_see_notes(client: TestClient, owner, project):
    other_project = client.post("/v1/projects", json={"name": "Other one"}, headers=owner).json()
    note = client.post(f"/v1/projects/{project['id']}/notes", json={"title": "n"}, headers=owner).json()
    tok = make_token(client, owner, [other_project["id"]], scopes=["read", "notes:write"])
    assert client.get(f"/v1/notes/{note['id']}", headers=bearer(tok)).status_code == 404


# --- saved queries ---------------------------------------------------------------------


def test_saved_query_crud(client: TestClient, owner, project):
    pid = project["id"]
    body = {"name": "Q1 category", "sql": "select 1 as x", "chart": {"type": "bar", "x": "x", "y": ["x"]}}
    r = client.post(f"/v1/projects/{pid}/queries", json=body, headers=owner)
    assert r.status_code == 201, r.text
    q = r.json()
    assert client.post(f"/v1/projects/{pid}/queries", json=body, headers=owner).status_code == 409

    r = client.patch(
        f"/v1/queries/{q['id']}", json={"base_version": 1, "sql": "select 2 as x"}, headers=owner
    )
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["chart"]["type"] == "bar"
    r = client.patch(f"/v1/queries/{q['id']}", json={"base_version": 2, "chart": None}, headers=owner)
    assert r.status_code == 200 and r.json()["chart"] is None
    assert (
        client.patch(
            f"/v1/queries/{q['id']}", json={"base_version": 1, "sql": "x"}, headers=owner
        ).status_code
        == 409
    )
    assert [x["name"] for x in client.get(f"/v1/projects/{pid}/queries", headers=owner).json()] == [
        "Q1 category"
    ]
    assert client.delete(f"/v1/queries/{q['id']}", headers=owner).status_code == 204


def test_saved_query_access_and_scopes(client: TestClient, owner, other, project):
    pid = project["id"]
    q = client.post(
        f"/v1/projects/{pid}/queries", json={"name": "q", "sql": "select 1"}, headers=owner
    ).json()
    assert client.get(f"/v1/queries/{q['id']}", headers=other).status_code == 404
    assert client.post(f"/v1/queries/{q['id']}/run", headers=other).status_code == 404
    plain = make_token(client, owner, [pid])
    assert (
        client.post(
            f"/v1/projects/{pid}/queries", json={"name": "a", "sql": "select 1"}, headers=bearer(plain)
        ).status_code
        == 403
    )
    tok = make_token(client, owner, [pid], scopes=["read", "queries:write"])
    assert (
        client.post(
            f"/v1/projects/{pid}/queries", json={"name": "a", "sql": "select 1"}, headers=bearer(tok)
        ).status_code
        == 201
    )


# --- running SQL -------------------------------------------------------------------------


def test_run_query_returns_rows(client: TestClient, owner, analytics_table):
    sql = f"select store, count(*) as n, sum(sales) as total from {analytics_table} group by store order by store"
    r = client.post("/v1/queries/run", json={"sql": sql}, headers=owner)
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["columns"] == ["store", "n", "total"]
    assert [row[0] for row in res["rows"]] == ["S0", "S1", "S2"]
    assert sum(row[1] for row in res["rows"]) == 120
    assert isinstance(res["rows"][0][2], float) and res["truncated"] is False


def test_run_query_percent_sign_and_row_cap(client: TestClient, owner, analytics_table):
    r = client.post(
        "/v1/queries/run",
        json={"sql": f"select * from {analytics_table} where month like '2026-0%'"},
        headers=owner,
    )
    assert r.status_code == 200, r.text
    res = r.json()  # 90 matching rows, capped at QUERY_MAX_ROWS=50
    assert res["row_count"] == 50 and res["truncated"] is True


def test_run_query_is_read_only(client: TestClient, owner, analytics_table):
    for sql in (
        f"insert into {analytics_table} values ('X', '2026-01', 1)",
        f"delete from {analytics_table}",
        f"drop table {analytics_table}",
        f"select 1; delete from {analytics_table}",
        f"commit; delete from {analytics_table}",
    ):
        r = client.post("/v1/queries/run", json={"sql": sql}, headers=owner)
        assert r.status_code == 400, (sql, r.text)
    r = client.post("/v1/queries/run", json={"sql": f"select count(*) from {analytics_table}"}, headers=owner)
    assert r.json()["rows"][0][0] == 120


def test_run_query_errors_are_readable(client: TestClient, owner, analytics_table):
    r = client.post("/v1/queries/run", json={"sql": "select * from no_such_table"}, headers=owner)
    assert r.status_code == 400 and "no_such_table" in r.json()["detail"]


def test_run_query_requires_signed_in_user(client: TestClient, owner, project, analytics_table):
    tok = make_token(
        client, owner, ["*"], scopes=["read", "runs:write", "artifacts:write", "notes:write", "queries:write"]
    )
    assert client.post("/v1/queries/run", json={"sql": "select 1"}, headers=bearer(tok)).status_code == 403
    assert client.post("/v1/queries/run", json={"sql": "select 1"}).status_code == 401
    q = client.post(
        f"/v1/projects/{project['id']}/queries",
        json={"name": "c", "sql": f"select count(*) as n from {analytics_table}"},
        headers=owner,
    ).json()
    assert client.post(f"/v1/queries/{q['id']}/run", headers=bearer(tok)).status_code == 403
    r = client.post(f"/v1/queries/{q['id']}/run", headers=owner)
    assert r.status_code == 200 and r.json()["rows"] == [[120]]


def test_engine_status(client: TestClient, owner):
    r = client.get("/v1/queries/engine", headers=owner)
    assert r.status_code == 200 and r.json()["configured"] is True and r.json()["max_rows"] == 50


def test_run_query_cte_comment_and_semicolon(client: TestClient, owner, analytics_table):
    sql = (
        f"with t as (select store, sum(sales) as s from {analytics_table} group by store)\n"
        "select count(*) as n from t; -- trailing comment"
    )
    r = client.post("/v1/queries/run", json={"sql": sql}, headers=owner)
    assert r.status_code == 200, r.text
    assert r.json()["rows"] == [[3]]


def test_note_links_to_queries(client: TestClient, owner, project):
    pid = project["id"]
    q1 = client.post(
        f"/v1/projects/{pid}/queries", json={"name": "links-q1", "sql": "select 1"}, headers=owner
    ).json()
    q2 = client.post(
        f"/v1/projects/{pid}/queries", json={"name": "links-q2", "sql": "select 2"}, headers=owner
    ).json()
    other_proj = client.post(
        "/v1/projects", json={"name": "Other", "slug": f"other-{q1['id'][:8]}"}, headers=owner
    ).json()
    foreign = client.post(
        f"/v1/projects/{other_proj['id']}/queries", json={"name": "foreign", "sql": "select 3"}, headers=owner
    ).json()

    note = client.post(
        f"/v1/projects/{pid}/notes",
        json={
            "title": "Linked",
            "body": "## 6. Findings\n",
            "links": [{"query_id": q1["id"], "section": "6. Findings"}],
        },
        headers=owner,
    ).json()
    assert note["links"] == [{"query_id": q1["id"], "section": "6. Findings"}]

    # Duplicates collapse; queries of another project are dropped, never linked.
    r = client.patch(
        f"/v1/notes/{note['id']}",
        json={
            "base_version": 1,
            "links": [
                {"query_id": q1["id"], "section": "6. Findings"},
                {"query_id": q1["id"], "section": "6. Findings"},
                {"query_id": q2["id"], "section": ""},
                {"query_id": foreign["id"], "section": "6. Findings"},
            ],
        },
        headers=owner,
    )
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2
    assert r.json()["links"] == [
        {"query_id": q1["id"], "section": "6. Findings"},
        {"query_id": q2["id"], "section": ""},
    ]
    listed = client.get(f"/v1/projects/{pid}/notes", headers=owner).json()
    assert next(n for n in listed if n["id"] == note["id"])["links"] == r.json()["links"]

    # Deleting a query removes it from notes without changing their version.
    assert client.delete(f"/v1/queries/{q1['id']}", headers=owner).status_code == 204
    after = client.get(f"/v1/notes/{note['id']}", headers=owner).json()
    assert after["links"] == [{"query_id": q2["id"], "section": ""}] and after["version"] == 2

    # A body-only update keeps the links.
    r = client.patch(f"/v1/notes/{note['id']}", json={"base_version": 2, "body": "x"}, headers=owner)
    assert r.json()["links"] == [{"query_id": q2["id"], "section": ""}]
