from __future__ import annotations

import json

import httpx
import pytest

from vtcons_lab import LabClient, LabError

PROJECT = {"id": "11111111-1111-1111-1111-111111111111", "slug": "demo"}
RUN = {"id": "22222222-2222-2222-2222-222222222222", "project_id": PROJECT["id"], "name": "r", "status": "running"}


def make(handler, **kw) -> LabClient:
    return LabClient("http://lab.test", "vtl_secret", transport=httpx.MockTransport(handler), backoff=0, **kw)


def test_requires_url_and_token(monkeypatch):
    monkeypatch.delenv("VTCONS_LAB_URL", raising=False)
    monkeypatch.delenv("VTCONS_LAB_TOKEN", raising=False)
    with pytest.raises(LabError, match="VTCONS_LAB_URL"):
        LabClient()
    with pytest.raises(LabError, match="VTCONS_LAB_TOKEN"):
        LabClient("http://x")


def test_create_run_retries_with_same_idempotency_key():
    seen_keys: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/v1/projects":
            return httpx.Response(200, json=[PROJECT])
        if req.url.path.endswith("/runs"):
            seen_keys.append(req.headers["Idempotency-Key"])
            if len(seen_keys) < 3:
                return httpx.Response(503, json={"detail": "busy"})
            return httpx.Response(201, json=RUN)
        raise AssertionError(req.url)

    run = make(handler).start_run("demo", "r")
    assert run.id == RUN["id"]
    assert len(seen_keys) == 3 and len(set(seen_keys)) == 1


def test_network_error_retries_then_raises():
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        raise httpx.ConnectError("refused", request=req)

    with pytest.raises(LabError, match="Network error"):
        make(handler, max_retries=2).whoami()
    assert calls["n"] == 3


def test_error_message_has_hint():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Agent token has been revoked"})

    with pytest.raises(LabError) as err:
        make(handler).whoami()
    assert err.value.status == 401 and "revoked" in str(err.value) and "Hint" in str(err.value)


def test_upload_does_not_leak_token_and_context_manager_fails_run(tmp_path):
    f = tmp_path / "report.md"
    f.write_text("# hi")
    seen: dict[str, object] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        p = req.url.path
        if p == "/v1/projects":
            return httpx.Response(200, json=[PROJECT])
        if p.endswith("/runs"):
            return httpx.Response(201, json=RUN)
        if p.endswith("/artifacts/initiate"):
            body = json.loads(req.content)
            seen["initiate"] = body
            return httpx.Response(
                201,
                json={
                    "artifact": {"id": "a1"},
                    "upload": {"method": "PUT", "url": "https://storage.test/put", "headers": {"Content-Type": "text/markdown"}},
                },
            )
        if req.url.host == "storage.test":
            seen["upload_auth"] = req.headers.get("Authorization")
            seen["upload_body"] = req.content
            return httpx.Response(200)
        if p == "/v1/artifacts/a1/complete":
            return httpx.Response(200, json={"id": "a1", "status": "ready"})
        if p.endswith("/fail"):
            seen["fail"] = json.loads(req.content)["error"]
            return httpx.Response(200, json={**RUN, "status": "failed"})
        raise AssertionError(p)

    lab = make(handler)
    with pytest.raises(RuntimeError), lab.start_run("demo", "r") as run:
        assert run.log_artifact(f)["status"] == "ready"
        raise RuntimeError("analysis exploded")
    assert seen["upload_auth"] is None
    assert seen["upload_body"] == b"# hi"
    assert seen["initiate"]["mime_type"] == "text/markdown" and len(seen["initiate"]["checksum_sha256"]) == 64
    assert "analysis exploded" in str(seen["fail"])


def test_rejects_unsupported_file(tmp_path):
    f = tmp_path / "page.html"
    f.write_text("<h1>x</h1>")

    def handler(req):
        return httpx.Response(201, json=RUN)

    from vtcons_lab.client import Run

    with pytest.raises(LabError, match="Supported"):
        Run(make(handler), RUN).log_artifact(f)
