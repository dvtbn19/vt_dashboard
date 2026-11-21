"""Small client for publishing runs, metrics and artifacts to VTCONS Project Lab.

from vtcons_lab import LabClient

lab = LabClient()  # reads VTCONS_LAB_URL and VTCONS_LAB_TOKEN
with lab.start_run("ecommerce-sales-analysis", name="eda", params={"seed": 42}) as run:
    run.log_metric("rows", 5000)
    run.log_artifact("correlation.png")
# leaving the block completes the run; an exception marks it failed (and re-raises)
"""

from __future__ import annotations

import hashlib
import mimetypes
import os
import random
import subprocess
import time
import traceback
import uuid
from collections.abc import Mapping
from pathlib import Path
from types import TracebackType
from typing import Any

import httpx

DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
UPLOAD_TIMEOUT = httpx.Timeout(300.0, connect=10.0)
RETRY_STATUSES = {429, 502, 503, 504}

EXT_TYPES: dict[str, tuple[str, str]] = {
    ".png": ("image/png", "image"),
    ".jpg": ("image/jpeg", "image"),
    ".jpeg": ("image/jpeg", "image"),
    ".csv": ("text/csv", "csv"),
    ".md": ("text/markdown", "markdown"),
    ".markdown": ("text/markdown", "markdown"),
    ".json": ("application/vnd.plotly.v1+json", "plotly"),
}


class LabError(Exception):
    """An API call failed. `status` is the HTTP status (None for network errors)."""

    def __init__(self, message: str, status: int | None = None, detail: Any = None):
        super().__init__(message)
        self.status = status
        self.detail = detail


_HINTS = {
    401: "Check VTCONS_LAB_TOKEN: it may be missing, mistyped, expired or revoked.",
    403: "The token is valid but lacks permission (scope) for this action.",
    404: "Not found, or the token is not scoped to this project.",
    409: "The resource is in the wrong state (e.g. the run already finished).",
    413: "File too large for the server's limit.",
    415: "Unsupported file type. Supported: .png .jpg .csv .md .json (Plotly).",
}


def _detect_git_commit() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=3, check=False
        )
    except (OSError, subprocess.SubprocessError):
        return None
    sha = out.stdout.strip()
    return sha if out.returncode == 0 and len(sha) == 40 else None


class LabClient:
    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        *,
        timeout: httpx.Timeout | float = DEFAULT_TIMEOUT,
        max_retries: int = 3,
        backoff: float = 0.5,
        transport: httpx.BaseTransport | None = None,
    ):
        base_url = base_url or os.environ.get("VTCONS_LAB_URL")
        token = token or os.environ.get("VTCONS_LAB_TOKEN")
        if not base_url:
            raise LabError("No API URL. Pass base_url= or set VTCONS_LAB_URL (e.g. http://127.0.0.1:8000).")
        if not token:
            raise LabError("No token. Pass token= or set VTCONS_LAB_TOKEN (create one in Lab → Settings).")
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.backoff = backoff
        self._http = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {token}", "User-Agent": "vtcons-lab-sdk/0.1"},
            timeout=timeout,
            transport=transport,
        )
        # Presigned upload URLs must NOT receive our bearer token.
        self._upload = httpx.Client(timeout=UPLOAD_TIMEOUT, transport=transport)

    # ------------------------------------------------------------------ plumbing
    def close(self) -> None:
        self._http.close()
        self._upload.close()

    def __enter__(self) -> LabClient:  # noqa: PYI034 - Python 3.10 has no typing.Self
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _sleep(self, attempt: int, response: httpx.Response | None = None) -> None:
        delay = self.backoff * (2**attempt) + random.uniform(0, self.backoff)
        if response is not None and response.headers.get("Retry-After", "").isdigit():
            delay = max(delay, float(response.headers["Retry-After"]))
        time.sleep(min(delay, 30.0))

    def _send(
        self, client: httpx.Client, method: str, url: str, *, retry: bool, **kwargs: Any
    ) -> httpx.Response:
        """Send a request. Only retried when `retry` (safe or idempotency-keyed operations)."""
        attempts = self.max_retries + 1 if retry else 1
        last_exc: Exception | None = None
        for attempt in range(attempts):
            try:
                resp = client.request(method, url, **kwargs)
            except httpx.TransportError as exc:
                last_exc = exc
                if attempt + 1 < attempts:
                    self._sleep(attempt)
                    continue
                raise LabError(f"Network error calling {method} {url}: {exc}") from exc
            if resp.status_code in RETRY_STATUSES and attempt + 1 < attempts:
                self._sleep(attempt, resp)
                continue
            return resp
        raise LabError(f"Request failed: {last_exc}")  # pragma: no cover

    def _call(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: Mapping[str, Any] | None = None,
        retry: bool = False,
        idempotency_key: str | None = None,
    ) -> Any:
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        resp = self._send(self._http, method, path, retry=retry, json=json, params=params, headers=headers)
        if resp.is_success:
            return resp.json() if resp.content else None
        try:
            detail = resp.json().get("detail")
        except ValueError:
            detail = resp.text[:500]
        hint = _HINTS.get(resp.status_code, "")
        raise LabError(
            f"{method} {path} failed ({resp.status_code}): {detail}" + (f"\nHint: {hint}" if hint else ""),
            status=resp.status_code,
            detail=detail,
        )

    # ------------------------------------------------------------------ API
    def whoami(self) -> dict[str, Any]:
        return self._call("GET", "/v1/me", retry=True)

    def get_project(self, project: str) -> dict[str, Any]:
        """Look a project up by UUID or slug."""
        try:
            uuid.UUID(project)
            return self._call("GET", f"/v1/projects/{project}", retry=True)
        except ValueError:
            pass
        found = self._call("GET", "/v1/projects", params={"slug": project}, retry=True)
        if not found:
            raise LabError(
                f"Project '{project}' not found, or this token is not scoped to it. "
                "Create it in the Lab and give the token access.",
                status=404,
            )
        return found[0]

    def start_run(
        self,
        project: str,
        name: str,
        *,
        params: Mapping[str, Any] | None = None,
        tags: list[str] | None = None,
        notes: str | None = None,
        dataset_version: str | None = None,
        git_commit: str | None = None,
        source: str = "sdk",
    ) -> Run:
        proj = self.get_project(project)
        body = {
            "name": name,
            "params": dict(params or {}),
            "tags": list(tags or []),
            "notes": notes,
            "dataset_version": dataset_version,
            "git_commit": git_commit or _detect_git_commit(),
            "source": source,
        }
        data = self._call(
            "POST",
            f"/v1/projects/{proj['id']}/runs",
            json=body,
            retry=True,
            idempotency_key=str(uuid.uuid4()),
        )
        return Run(self, data)

    def get_run(self, run_id: str) -> dict[str, Any]:
        return self._call("GET", f"/v1/runs/{run_id}", retry=True)

    # ------------------------------------------------------------------ notes
    def list_notes(self, project: str) -> list[dict[str, Any]]:
        proj = self.get_project(project)
        return self._call("GET", f"/v1/projects/{proj['id']}/notes", retry=True)

    def get_note(self, note_id: str) -> dict[str, Any]:
        return self._call("GET", f"/v1/notes/{note_id}", retry=True)

    def create_note(self, project: str, title: str, body: str = "") -> dict[str, Any]:
        """Create a working note (needs the `notes:write` scope)."""
        proj = self.get_project(project)
        return self._call(
            "POST",
            f"/v1/projects/{proj['id']}/notes",
            json={"title": title, "body": body},
            retry=True,
            idempotency_key=str(uuid.uuid4()),
        )

    def update_note(
        self,
        note_id: str,
        base_version: int,
        *,
        title: str | None = None,
        body: str | None = None,
        links: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Update a note you read at `base_version`. Raises LabError(status=409) if it changed since:
        the owner may be editing it in the Lab, so re-read it instead of overwriting.

        `links` replaces the note's links to saved queries: `[{"query_id": id, "section": "6. Findings"}]`
        (`section` is a `## heading` of the note, or "" for the whole note). Read `note["links"]` first
        and extend it, so links the owner made are kept."""
        payload: dict[str, Any] = {"base_version": base_version}
        if title is not None:
            payload["title"] = title
        if body is not None:
            payload["body"] = body
        if links is not None:
            payload["links"] = links
        return self._call("PATCH", f"/v1/notes/{note_id}", json=payload)

    def publish_note(self, project: str, title: str, body: str) -> dict[str, Any]:
        """Create the note `title` if the project has none with that title; otherwise leave the
        existing one untouched (it may contain the owner's edits) and return it."""
        for note in self.list_notes(project):
            if note["title"] == title:
                return self.get_note(note["id"])
        return self.create_note(project, title, body)

    # ------------------------------------------------------------------ saved queries
    def list_queries(self, project: str) -> list[dict[str, Any]]:
        proj = self.get_project(project)
        return self._call("GET", f"/v1/projects/{proj['id']}/queries", retry=True)

    def save_query(
        self,
        project: str,
        name: str,
        sql: str,
        *,
        description: str = "",
        chart: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create or update the saved query `name` (needs `queries:write`).

        `chart` is optional: {"type": "bar"|"line"|"scatter", "x": "<column>", "y": ["<column>", ...]}.
        Queries with a chart appear on the project's dashboard. Agents can save SQL but never run it.
        """
        proj = self.get_project(project)
        body: dict[str, Any] = {"name": name, "sql": sql, "description": description, "chart": chart}
        for q in self._call("GET", f"/v1/projects/{proj['id']}/queries", retry=True):
            if q["name"] == name:
                if (
                    q["sql"] == sql
                    and q["description"] == description
                    and q.get("chart") == (dict(chart) if chart else None)
                ):
                    return q
                return self._call(
                    "PATCH", f"/v1/queries/{q['id']}", json={**body, "base_version": q["version"]}
                )
        return self._call(
            "POST",
            f"/v1/projects/{proj['id']}/queries",
            json=body,
            retry=True,
            idempotency_key=str(uuid.uuid4()),
        )


class Run:
    """A run in progress. Use as a context manager to complete/fail it automatically."""

    def __init__(self, client: LabClient, data: dict[str, Any]):
        self.client = client
        self.data = data
        self.id: str = data["id"]
        self.project_id: str = data["project_id"]

    def __repr__(self) -> str:
        return f"<Run {self.id} {self.data.get('name')!r} {self.data.get('status')}>"

    # metrics -----------------------------------------------------------------
    def log_metric(self, key: str, value: float, step: int | None = None) -> None:
        self.log_metrics({key: value}, step=step)

    def log_metrics(self, metrics: Mapping[str, float], step: int | None = None) -> None:
        items = [{"key": k, "value": float(v), "step": step} for k, v in metrics.items()]
        for i in range(0, len(items), 1000):
            self.client._call(
                "POST",
                f"/v1/runs/{self.id}/metrics",
                json={"metrics": items[i : i + 1000]},
                retry=True,
                idempotency_key=str(uuid.uuid4()),
            )

    # artifacts ---------------------------------------------------------------
    def log_artifact(
        self,
        path: str | os.PathLike[str],
        *,
        name: str | None = None,
        mime_type: str | None = None,
        kind: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Upload a file: register → PUT to the signed URL → verify. Returns the artifact record."""
        file = Path(path)
        if not file.is_file():
            raise LabError(f"Artifact file not found: {file}")
        data = file.read_bytes()
        if mime_type is None:
            guessed = EXT_TYPES.get(file.suffix.lower())
            if guessed is None:
                guess = mimetypes.guess_type(file.name)[0]
                raise LabError(
                    f"Cannot publish '{file.name}' ({guess or 'unknown type'}). "
                    "Supported: .png .jpg .jpeg .csv .md .json (Plotly figure)."
                )
            mime_type, kind = guessed[0], kind or guessed[1]
        body = {
            "name": name or file.name,
            "mime_type": mime_type,
            "size_bytes": len(data),
            "checksum_sha256": hashlib.sha256(data).hexdigest(),
            "kind": kind,
            "description": description,
        }
        init = self.client._call(
            "POST",
            f"/v1/runs/{self.id}/artifacts/initiate",
            json=body,
            retry=True,
            idempotency_key=str(uuid.uuid4()),
        )
        upload = init["upload"]
        resp = self.client._send(
            self.client._upload,
            upload["method"],
            upload["url"],
            retry=True,
            content=data,
            headers=upload["headers"],
        )
        if not resp.is_success:
            raise LabError(
                f"Upload of {file.name} failed ({resp.status_code}): {resp.text[:300]}", resp.status_code
            )
        return self.client._call("POST", f"/v1/artifacts/{init['artifact']['id']}/complete", retry=True)

    # lifecycle ---------------------------------------------------------------
    def complete(self, notes: str | None = None) -> dict[str, Any]:
        self.data = self.client._call(
            "POST", f"/v1/runs/{self.id}/complete", json={"notes": notes} if notes else None, retry=True
        )
        return self.data

    def fail(self, error: str) -> dict[str, Any]:
        self.data = self.client._call(
            "POST", f"/v1/runs/{self.id}/fail", json={"error": error[:10_000] or "failed"}, retry=True
        )
        return self.data

    def __enter__(self) -> Run:  # noqa: PYI034 - Python 3.10 has no typing.Self
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        if exc_type is None:
            self.complete()
            return
        message = "".join(traceback.format_exception(exc_type, exc, tb))[-8000:]
        try:
            self.fail(message)
        except LabError:
            pass  # don't mask the original exception
