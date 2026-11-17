"""Object storage abstraction.

- `R2Storage`: Cloudflare R2 (S3-compatible). Clients upload/download directly with presigned URLs,
  so large files never pass through FastAPI.
- `LocalStorage`: development adapter. Files live on local disk; the API issues short-lived
  HMAC-signed URLs that hit `/v1/storage/local/{token}` (see `routers/storage_local.py`).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import quote

from app.config import Settings, get_settings


@dataclass
class SignedUrl:
    url: str
    method: str
    headers: dict[str, str]
    expires_at: datetime


class StorageError(Exception):
    pass


class Storage(Protocol):
    name: str

    def presign_put(self, key: str, content_type: str, size: int) -> SignedUrl: ...
    def presign_get(self, key: str, filename: str, content_type: str, inline: bool) -> SignedUrl: ...
    def size(self, key: str) -> int | None: ...
    def read_prefix(self, key: str, max_bytes: int) -> bytes: ...
    def sha256(self, key: str) -> str: ...
    def check(self) -> None: ...


def _content_disposition(filename: str, inline: bool) -> str:
    kind = "inline" if inline else "attachment"
    ascii_name = filename.encode("ascii", "ignore").decode() or "download"
    ascii_name = ascii_name.replace('"', "").replace("\\", "")
    return f"{kind}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


# --------------------------------------------------------------------------- local


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


class LocalStorage:
    name = "local"

    def __init__(self, root: str, secret: str, public_url: str, upload_ttl: int, download_ttl: int):
        self.root = Path(root).resolve()
        self.secret = secret.encode()
        self.public_url = public_url.rstrip("/")
        self.upload_ttl = upload_ttl
        self.download_ttl = download_ttl

    # signed tokens -----------------------------------------------------------
    def sign(self, payload: dict[str, Any]) -> str:
        body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
        sig = _b64(hmac.new(self.secret, body.encode(), hashlib.sha256).digest())
        return f"{body}.{sig}"

    def verify(self, token: str, op: str) -> dict[str, Any]:
        try:
            body, sig = token.split(".", 1)
        except ValueError as exc:
            raise StorageError("Malformed token") from exc
        expected = _b64(hmac.new(self.secret, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise StorageError("Bad signature")
        payload = json.loads(_unb64(body))
        if payload.get("op") != op:
            raise StorageError("Wrong operation")
        if int(payload.get("exp", 0)) < int(time.time()):
            raise StorageError("URL expired")
        return payload

    def path_for(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise StorageError("Invalid object key")
        return path

    # Storage protocol --------------------------------------------------------
    def presign_put(self, key: str, content_type: str, size: int) -> SignedUrl:
        exp = datetime.now(UTC) + timedelta(seconds=self.upload_ttl)
        token = self.sign(
            {"op": "put", "k": key, "ct": content_type, "sz": size, "exp": int(exp.timestamp())}
        )
        return SignedUrl(
            url=f"{self.public_url}/v1/storage/local/{token}",
            method="PUT",
            headers={"Content-Type": content_type},
            expires_at=exp,
        )

    def presign_get(self, key: str, filename: str, content_type: str, inline: bool) -> SignedUrl:
        exp = datetime.now(UTC) + timedelta(seconds=self.download_ttl)
        token = self.sign(
            {
                "op": "get",
                "k": key,
                "ct": content_type,
                "cd": _content_disposition(filename, inline),
                "exp": int(exp.timestamp()),
            }
        )
        return SignedUrl(
            url=f"{self.public_url}/v1/storage/local/{token}", method="GET", headers={}, expires_at=exp
        )

    def size(self, key: str) -> int | None:
        path = self.path_for(key)
        return path.stat().st_size if path.is_file() else None

    def read_prefix(self, key: str, max_bytes: int) -> bytes:
        with self.path_for(key).open("rb") as fh:
            return fh.read(max_bytes)

    def sha256(self, key: str) -> str:
        digest = hashlib.sha256()
        with self.path_for(key).open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def check(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        if not os.access(self.root, os.W_OK):
            raise StorageError(f"Storage dir not writable: {self.root}")


# --------------------------------------------------------------------------- R2


class R2Storage:
    name = "r2"

    def __init__(self, settings: Settings):
        import boto3
        from botocore.config import Config

        endpoint = settings.r2_endpoint_url or f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
        self.bucket = settings.r2_bucket
        self.upload_ttl = settings.upload_url_ttl_seconds
        self.download_ttl = settings.download_url_ttl_seconds
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4", connect_timeout=5, read_timeout=30, retries={"max_attempts": 3}
            ),
        )

    def presign_put(self, key: str, content_type: str, size: int) -> SignedUrl:
        url = self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type, "ContentLength": size},
            ExpiresIn=self.upload_ttl,
        )
        exp = datetime.now(UTC) + timedelta(seconds=self.upload_ttl)
        return SignedUrl(url=url, method="PUT", headers={"Content-Type": content_type}, expires_at=exp)

    def presign_get(self, key: str, filename: str, content_type: str, inline: bool) -> SignedUrl:
        url = self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ResponseContentDisposition": _content_disposition(filename, inline),
                "ResponseContentType": content_type,
            },
            ExpiresIn=self.download_ttl,
        )
        exp = datetime.now(UTC) + timedelta(seconds=self.download_ttl)
        return SignedUrl(url=url, method="GET", headers={}, expires_at=exp)

    def size(self, key: str) -> int | None:
        from botocore.exceptions import ClientError

        try:
            head = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise StorageError(str(exc)) from exc
        return int(head["ContentLength"])

    def read_prefix(self, key: str, max_bytes: int) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=key, Range=f"bytes=0-{max_bytes - 1}")
        return obj["Body"].read(max_bytes)

    def sha256(self, key: str) -> str:
        digest = hashlib.sha256()
        body = self.client.get_object(Bucket=self.bucket, Key=key)["Body"]
        for chunk in iter(lambda: body.read(1024 * 1024), b""):
            digest.update(chunk)
        return digest.hexdigest()

    def check(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception as exc:  # noqa: BLE001 - surface any failure as not-ready
            raise StorageError(f"R2 bucket not reachable: {exc.__class__.__name__}") from exc


def build_storage(settings: Settings) -> Storage:
    if settings.storage_backend == "r2":
        return R2Storage(settings)
    return LocalStorage(
        settings.local_storage_dir,
        settings.storage_signing_secret,
        settings.api_public_url,
        settings.upload_url_ttl_seconds,
        settings.download_url_ttl_seconds,
    )


@lru_cache
def get_storage() -> Storage:
    return build_storage(get_settings())
