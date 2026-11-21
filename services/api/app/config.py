"""Application settings, loaded from environment variables (and `.env` in development)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://vtlab:vtlab@127.0.0.1:5432/vtlab"

    # Public base URL of this API (used to build local-storage upload/download links).
    api_public_url: str = "http://127.0.0.1:8000"
    # Browser origins allowed to call the API directly (comma separated).
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"

    # --- user auth --------------------------------------------------------
    # "supabase": verify Supabase-issued JWTs. "local": dev-only HS256 tokens issued by /v1/auth/local-login.
    auth_mode: Literal["supabase", "local"] = "local"
    supabase_url: str = ""
    supabase_jwt_secret: str = ""  # legacy HS256 secret; if empty, JWKS (asymmetric keys) is used
    supabase_jwt_audience: str = "authenticated"
    local_jwt_secret: str = ""
    local_login_email: str = "owner@example.com"
    local_login_password: str = ""
    # Only these e-mails may use the lab (comma separated). Empty = anyone with a valid token.
    lab_allowed_emails: str = ""

    # --- storage ------------------------------------------------------------
    storage_backend: Literal["local", "r2"] = "local"
    local_storage_dir: str = "./data/artifacts"
    storage_signing_secret: str = ""
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_endpoint_url: str = ""  # optional override; defaults to https://<account>.r2.cloudflarestorage.com

    # --- analytics queries (optional) -----------------------------------------------
    # Connection string of a READ-ONLY database role used to run SQL from the Lab
    # (e.g. Supabase role `team_ro` limited to schema `range_review`). Empty = feature off.
    analytics_database_url: str = ""
    query_timeout_seconds: int = 20
    query_max_rows: int = 5000

    # --- limits ---------------------------------------------------------------
    max_artifact_bytes: int = 50 * 1024 * 1024
    upload_url_ttl_seconds: int = 900
    download_url_ttl_seconds: int = 300
    preview_csv_rows: int = 50
    preview_csv_max_bytes: int = 256 * 1024
    preview_text_max_bytes: int = 256 * 1024
    preview_json_max_bytes: int = 5 * 1024 * 1024
    checksum_verify_max_bytes: int = 25 * 1024 * 1024

    @model_validator(mode="after")
    def _check_security(self) -> Settings:
        if self.env == "production":
            if self.auth_mode != "supabase":
                raise ValueError("AUTH_MODE must be 'supabase' when ENV=production (local auth is dev-only)")
            if not self.supabase_url:
                raise ValueError("SUPABASE_URL is required when ENV=production")
            if not self.lab_allowed_emails.strip():
                raise ValueError("LAB_ALLOWED_EMAILS is required when ENV=production")
            if self.storage_backend == "local" and len(self.storage_signing_secret) < 32:
                raise ValueError(
                    "STORAGE_SIGNING_SECRET (>=32 chars) is required for local storage in production"
                )
        if self.auth_mode == "local" and len(self.local_jwt_secret) < 32:
            raise ValueError("LOCAL_JWT_SECRET (>=32 chars) is required when AUTH_MODE=local")
        if self.storage_backend == "local" and len(self.storage_signing_secret) < 32:
            raise ValueError("STORAGE_SIGNING_SECRET (>=32 chars) is required when STORAGE_BACKEND=local")
        if self.storage_backend == "r2":
            missing = [
                n for n in ("r2_access_key_id", "r2_secret_access_key", "r2_bucket") if not getattr(self, n)
            ]
            if not (self.r2_account_id or self.r2_endpoint_url):
                missing.append("r2_account_id or r2_endpoint_url")
            if missing:
                raise ValueError(f"STORAGE_BACKEND=r2 requires: {', '.join(missing)}")
        return self

    @property
    def supabase_issuer(self) -> str:
        """`https://<ref>.supabase.co/auth/v1`, tolerant of a pasted `/rest/v1/` or trailing slash."""
        from urllib.parse import urlsplit

        parts = urlsplit(self.supabase_url.strip())
        return f"{parts.scheme}://{parts.netloc}/auth/v1"

    @property
    def allowed_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.lab_allowed_emails.split(",") if e.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
