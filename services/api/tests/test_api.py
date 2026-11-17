from __future__ import annotations

import hashlib
import json
import struct
import uuid
import zlib

import jwt
import pytest
from fastapi.testclient import TestClient

from tests.conftest import SECRET, auth, bearer, make_token


def tiny_png() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    raw = b"\x00\xff\x00\x00"  # one red pixel, filter byte 0
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def upload(
    client: TestClient, headers, run_id: str, name: str, data: bytes, mime: str, checksum=True, **extra
):
    body = {"name": name, "mime_type": mime, "size_bytes": len(data), **extra}
    if checksum:
        body["checksum_sha256"] = hashlib.sha256(data).hexdigest()
    r = client.post(f"/v1/runs/{run_id}/artifacts/initiate", json=body, headers=headers)
    assert r.status_code == 201, r.text
    init = r.json()
    put = client.put(init["upload"]["url"], content=data, headers=init["upload"]["headers"])
    assert put.status_code == 200, put.text
    return init["artifact"]["id"], client.post(
        f"/v1/artifacts/{init['artifact']['id']}/complete", headers=headers
    )


# --------------------------------------------------------------------------- health


def test_health(client: TestClient):
    assert client.get("/health/live").json() == {"status": "ok"}
    r = client.get("/health/ready")
    assert r.status_code == 200, r.text
    assert r.json()["checks"]["database"] == "ok"


# --------------------------------------------------------------------------- auth negatives


def test_requires_token(client: TestClient):
    assert client.get("/v1/projects").status_code == 401
    assert client.get("/v1/projects", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert client.get("/v1/projects", headers={"Authorization": "Bearer vtl_unknown"}).status_code == 401


def test_rejects_forged_and_expired_jwt(client: TestClient):
    forged = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "owner@example.com",
            "aud": "authenticated",
            "iss": "vtcons-lab-local",
            "exp": 9999999999,
        },
        "wrong-secret-" * 4,
        algorithm="HS256",
    )
    assert client.get("/v1/projects", headers=bearer(forged)).status_code == 401
    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "owner@example.com",
            "aud": "authenticated",
            "iss": "vtcons-lab-local",
            "exp": 1,
        },
        SECRET,
        algorithm="HS256",
    )
    assert client.get("/v1/projects", headers=bearer(expired)).status_code == 401
    none_alg = jwt.encode({"sub": str(uuid.uuid4()), "exp": 9999999999}, None, algorithm="none")
    assert client.get("/v1/projects", headers=bearer(none_alg)).status_code == 401


def test_email_allow_list(client: TestClient):
    r = client.get("/v1/projects", headers=auth("stranger@example.com"))
    assert r.status_code == 403


def test_local_login(client: TestClient):
    bad = client.post("/v1/auth/local-login", json={"email": "owner@example.com", "password": "nope"})
    assert bad.status_code == 401
    ok = client.post(
        "/v1/auth/local-login",
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    assert ok.status_code == 200
    me = client.get("/v1/me", headers=bearer(ok.json()["access_token"]))
    assert me.json()["email"] == "owner@example.com"


def test_production_refuses_local_auth(monkeypatch):
    from app.config import Settings

    with pytest.raises(ValueError, match="AUTH_MODE must be 'supabase'"):
        Settings(
            env="production", auth_mode="local", local_jwt_secret="x" * 40, storage_signing_secret="y" * 40
        )


# --------------------------------------------------------------------------- projects


def test_project_crud_and_isolation(client: TestClient, owner, other, project):
    pid = project["id"]
    assert project["visibility"] == "private"
    assert any(p["id"] == pid for p in client.get("/v1/projects", headers=owner).json())
    # another user cannot see, read or edit it
    assert all(p["id"] != pid for p in client.get("/v1/projects", headers=other).json())
    assert client.get(f"/v1/projects/{pid}", headers=other).status_code == 404
    assert client.patch(f"/v1/projects/{pid}", json={"name": "x"}, headers=other).status_code == 404
    assert client.get(f"/v1/projects/{pid}/runs", headers=other).status_code == 404
    # owner edits
    r = client.patch(
        f"/v1/projects/{pid}",
        json={"summary": "EDA on sales", "tags": ["eda", "eda", "sales"]},
        headers=owner,
    )
    assert r.status_code == 200 and r.json()["tags"] == ["eda", "sales"]
    # duplicate slug
    dup = client.post("/v1/projects", json={"name": "Dup", "slug": project["slug"]}, headers=owner)
    assert dup.status_code == 409
    # bad slug
    assert (
        client.post("/v1/projects", json={"name": "B", "slug": "Bad Slug"}, headers=owner).status_code == 422
    )


def test_public_projects_only_public(client: TestClient, owner, project):
    slug = project["slug"]
    assert client.get(f"/v1/public/projects/{slug}").status_code == 404
    assert all(p["slug"] != slug for p in client.get("/v1/public/projects").json())
    client.patch(f"/v1/projects/{project['id']}", json={"visibility": "public"}, headers=owner)
    r = client.get(f"/v1/public/projects/{slug}")
    assert r.status_code == 200
    assert "id" not in r.json()  # internal ids are not exposed publicly


# --------------------------------------------------------------------------- credentials & scopes


def test_agent_credential_scopes(client: TestClient, owner, project):
    pid = project["id"]
    other_project = client.post("/v1/projects", json={"name": "Other"}, headers=owner).json()
    created = client.post(
        "/v1/credentials", json={"name": "scoped", "project_ids": [pid]}, headers=owner
    ).json()
    token, cred_id = created["token"], created["id"]
    listing = client.get("/v1/credentials", headers=owner).json()
    assert all("token" not in c and "token_hash" not in c for c in listing)
    h = bearer(token)
    # scoped: sees its project only
    assert [p["id"] for p in client.get("/v1/projects", headers=h).json()] == [pid]
    assert client.get(f"/v1/projects/{other_project['id']}", headers=h).status_code == 404
    assert (
        client.post(f"/v1/projects/{other_project['id']}/runs", json={"name": "x"}, headers=h).status_code
        == 404
    )
    # agents cannot manage projects or credentials
    assert client.post("/v1/projects", json={"name": "nope"}, headers=h).status_code == 403
    assert (
        client.post("/v1/credentials", json={"name": "n", "project_ids": ["*"]}, headers=h).status_code == 403
    )
    assert client.get("/v1/overview", headers=h).status_code == 403
    # read-only token cannot write
    ro = bearer(make_token(client, owner, [pid], scopes=["read"]))
    assert client.post(f"/v1/projects/{pid}/runs", json={"name": "x"}, headers=ro).status_code == 403
    # revocation
    assert client.post(f"/v1/credentials/{cred_id}/revoke", headers=owner).status_code == 200
    assert client.get("/v1/projects", headers=h).status_code == 401


def test_cannot_scope_token_to_someone_elses_project(client: TestClient, owner, other, project):
    r = client.post("/v1/credentials", json={"name": "x", "project_ids": [project["id"]]}, headers=other)
    assert r.status_code == 404


# --------------------------------------------------------------------------- runs & metrics


def test_run_lifecycle_and_idempotency(client: TestClient, owner, project):
    h = bearer(make_token(client, owner, [project["id"]]))
    body = {"name": "eda-1", "params": {"seed": 42}, "tags": ["eda"]}
    r1 = client.post(f"/v1/projects/{project['id']}/runs", json=body, headers={**h, "Idempotency-Key": "k-1"})
    r2 = client.post(f"/v1/projects/{project['id']}/runs", json=body, headers={**h, "Idempotency-Key": "k-1"})
    assert r1.status_code == r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]
    assert r2.headers.get("Idempotent-Replayed") == "true"
    conflict = client.post(
        f"/v1/projects/{project['id']}/runs",
        json={"name": "different"},
        headers={**h, "Idempotency-Key": "k-1"},
    )
    assert conflict.status_code == 422
    runs = client.get(f"/v1/projects/{project['id']}/runs", headers=owner).json()
    assert len(runs) == 1 and runs[0]["created_by"] == "agent:test-agent"

    run_id = r1.json()["id"]
    m = {"metrics": [{"key": "rows", "value": 1000}, {"key": "loss", "value": 0.5, "step": 1}]}
    assert (
        client.post(f"/v1/runs/{run_id}/metrics", json=m, headers={**h, "Idempotency-Key": "m-1"}).status_code
        == 201
    )
    assert (
        client.post(f"/v1/runs/{run_id}/metrics", json=m, headers={**h, "Idempotency-Key": "m-1"}).status_code
        == 201
    )
    nan = client.post(
        f"/v1/runs/{run_id}/metrics",
        content=b'{"metrics":[{"key":"x","value":NaN}]}',
        headers={**h, "Content-Type": "application/json"},
    )
    assert nan.status_code == 422
    detail = client.get(f"/v1/runs/{run_id}", headers=owner).json()
    assert len(detail["metrics"]) == 2  # the retried batch was not duplicated

    done = client.post(f"/v1/runs/{run_id}/complete", headers=h)
    assert done.status_code == 200 and done.json()["status"] == "completed" and done.json()["finished_at"]
    assert client.post(f"/v1/runs/{run_id}/complete", headers=h).status_code == 200  # idempotent
    assert client.post(f"/v1/runs/{run_id}/fail", json={"error": "x"}, headers=h).status_code == 409
    assert client.post(f"/v1/runs/{run_id}/metrics", json=m, headers=h).status_code == 409


def test_failed_run_is_preserved(client: TestClient, owner, project):
    run = client.post(f"/v1/projects/{project['id']}/runs", json={"name": "boom"}, headers=owner).json()
    r = client.post(f"/v1/runs/{run['id']}/fail", json={"error": "ValueError: bad input"}, headers=owner)
    assert r.json()["status"] == "failed"
    detail = client.get(f"/v1/runs/{run['id']}", headers=owner).json()
    assert detail["error"] == "ValueError: bad input"
    ov = client.get("/v1/overview", headers=owner).json()
    assert ov["failed_count"] >= 1


def test_run_isolation(client: TestClient, owner, other, project):
    run = client.post(f"/v1/projects/{project['id']}/runs", json={"name": "r"}, headers=owner).json()
    assert client.get(f"/v1/runs/{run['id']}", headers=other).status_code == 404
    assert client.post(f"/v1/runs/{run['id']}/complete", headers=other).status_code == 404
    other_token = bearer(make_token(client, other, ["*"]))
    assert client.get(f"/v1/runs/{run['id']}", headers=other_token).status_code == 404


# --------------------------------------------------------------------------- artifacts


@pytest.fixture()
def run(client: TestClient, owner, project) -> dict:
    return client.post(f"/v1/projects/{project['id']}/runs", json={"name": "artifacts"}, headers=owner).json()


def test_artifact_lifecycle(client: TestClient, owner, other, run):
    png = tiny_png()
    aid, done = upload(client, owner, run["id"], "corr.png", png, "image/png")
    assert done.status_code == 200 and done.json()["status"] == "ready"

    csv_data = b"order_id,category,revenue\n" + b"".join(
        f"{i},books,{i * 1.5}\n".encode() for i in range(200)
    )
    cid, done = upload(client, owner, run["id"], "preview.csv", csv_data, "text/csv")
    assert done.status_code == 200

    md = b"# Report\n\n<script>alert(1)</script>\n\nHello **world**"
    mid, done = upload(client, owner, run["id"], "report.md", md, "text/markdown")
    assert done.status_code == 200

    fig = json.dumps(
        {
            "data": [{"type": "bar", "x": ["a"], "y": [1]}],
            "layout": {"images": [{"source": "https://evil"}], "title": {"text": "t"}},
        }
    ).encode()
    pid, done = upload(client, owner, run["id"], "chart.json", fig, "application/json", kind="plotly")
    assert done.status_code == 200 and done.json()["kind"] == "plotly"

    # previews
    p = client.get(f"/v1/artifacts/{cid}/preview", headers=owner).json()
    assert p["columns"] == ["order_id", "category", "revenue"] and len(p["rows"]) == 50 and p["truncated"]
    p = client.get(f"/v1/artifacts/{mid}/preview", headers=owner).json()
    assert p["text"].startswith("# Report")  # raw text; the web renderer never renders HTML
    p = client.get(f"/v1/artifacts/{pid}/preview", headers=owner).json()
    assert "images" not in p["figure"]["layout"] and p["figure"]["data"][0]["type"] == "bar"
    p = client.get(f"/v1/artifacts/{aid}/preview", headers=owner).json()
    img = client.get(p["url"])
    assert img.status_code == 200 and img.content == png
    assert img.headers["content-type"] == "image/png"
    assert img.headers["x-content-type-options"] == "nosniff"

    # downloads: non-images are attachments with a sandbox CSP
    link = client.get(f"/v1/artifacts/{mid}/download", headers=owner).json()
    dl = client.get(link["url"])
    assert dl.content == md and dl.headers["content-disposition"].startswith("attachment")
    assert "sandbox" in dl.headers["content-security-policy"]

    # isolation
    assert client.get(f"/v1/artifacts/{aid}/download", headers=other).status_code == 404
    assert client.get(f"/v1/artifacts/{aid}/preview", headers=other).status_code == 404

    detail = client.get(f"/v1/runs/{run['id']}", headers=owner).json()
    assert {a["name"] for a in detail["artifacts"]} == {"corr.png", "preview.csv", "report.md", "chart.json"}


def test_artifact_rejections(client: TestClient, owner, run):
    rid = run["id"]
    # unsupported type
    r = client.post(
        f"/v1/runs/{rid}/artifacts/initiate",
        json={"name": "x.html", "mime_type": "text/html", "size_bytes": 10},
        headers=owner,
    )
    assert r.status_code == 415
    # too large
    r = client.post(
        f"/v1/runs/{rid}/artifacts/initiate",
        json={"name": "x.png", "mime_type": "image/png", "size_bytes": 10**9},
        headers=owner,
    )
    assert r.status_code == 413
    # wrong magic bytes
    _, done = upload(client, owner, rid, "fake.png", b"<svg onload=alert(1)>", "image/png")
    assert done.status_code == 422 and "PNG" in done.json()["detail"]
    # checksum mismatch
    data = b"a,b\n1,2\n"
    r = client.post(
        f"/v1/runs/{rid}/artifacts/initiate",
        json={"name": "c.csv", "mime_type": "text/csv", "size_bytes": len(data), "checksum_sha256": "0" * 64},
        headers=owner,
    ).json()
    client.put(r["upload"]["url"], content=data, headers=r["upload"]["headers"])
    done = client.post(f"/v1/artifacts/{r['artifact']['id']}/complete", headers=owner)
    assert done.status_code == 422
    # failed artifact cannot be downloaded
    assert client.get(f"/v1/artifacts/{r['artifact']['id']}/download", headers=owner).status_code == 409
    # complete before upload
    r = client.post(
        f"/v1/runs/{rid}/artifacts/initiate",
        json={"name": "n.csv", "mime_type": "text/csv", "size_bytes": 5},
        headers=owner,
    ).json()
    assert client.post(f"/v1/artifacts/{r['artifact']['id']}/complete", headers=owner).status_code == 409
    # upload larger than declared
    big = client.put(r["upload"]["url"], content=b"0123456789", headers=r["upload"]["headers"])
    assert big.status_code == 413
    # wrong content type on upload
    assert (
        client.put(r["upload"]["url"], content=b"12345", headers={"Content-Type": "text/html"}).status_code
        == 400
    )
    # tampered upload token
    bad = r["upload"]["url"][:-3] + "abc"
    assert client.put(bad, content=b"12345", headers=r["upload"]["headers"]).status_code == 403
    # invalid plotly JSON
    _, done = upload(client, owner, rid, "p.json", b'{"nodata": 1}', "application/json")
    assert done.status_code == 422


def test_no_artifacts_after_run_finished(client: TestClient, owner, run):
    client.post(f"/v1/runs/{run['id']}/complete", headers=owner)
    r = client.post(
        f"/v1/runs/{run['id']}/artifacts/initiate",
        json={"name": "x.csv", "mime_type": "text/csv", "size_bytes": 3},
        headers=owner,
    )
    assert r.status_code == 409


def test_cannot_overwrite_ready_artifact(client: TestClient, owner, run):
    data = b"a\n1\n"
    r = client.post(
        f"/v1/runs/{run['id']}/artifacts/initiate",
        json={"name": "a.csv", "mime_type": "text/csv", "size_bytes": len(data)},
        headers=owner,
    ).json()
    client.put(r["upload"]["url"], content=data, headers=r["upload"]["headers"])
    assert client.post(f"/v1/artifacts/{r['artifact']['id']}/complete", headers=owner).status_code == 200
    again = client.put(r["upload"]["url"], content=b"b\n2\n", headers=r["upload"]["headers"])
    assert again.status_code == 409
