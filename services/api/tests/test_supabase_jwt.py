"""Supabase-mode JWT verification (ES256 via JWKS), with the JWKS fetch stubbed."""

from __future__ import annotations

import time
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app import auth
from app.config import Settings

URL = "https://abc.supabase.co"


@pytest.fixture()
def keypair(monkeypatch):
    key = ec.generate_private_key(ec.SECP256R1())
    stub = SimpleNamespace(get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=key.public_key()))
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: stub)
    return key


def settings(url: str = URL) -> Settings:
    return Settings(
        env="test",
        auth_mode="supabase",
        supabase_url=url,
        storage_backend="local",
        storage_signing_secret="s" * 40,
    )


def token(key, **over) -> str:
    claims = {
        "sub": str(uuid.uuid4()),
        "email": "owner@example.com",
        "aud": "authenticated",
        "iss": f"{URL}/auth/v1",
        "exp": int(time.time()) + 600,
        "iat": int(time.time()),
        "role": "authenticated",
        **over,
    }
    return jwt.encode(claims, key, algorithm="ES256", headers={"kid": "k1"})


def test_valid_es256_token(keypair):
    claims = auth.verify_user_jwt(token(keypair), settings())
    assert claims["email"] == "owner@example.com"


def test_pasted_rest_url_is_tolerated(keypair):
    assert auth.verify_user_jwt(token(keypair), settings(URL + "/rest/v1/"))["aud"] == "authenticated"


@pytest.mark.parametrize(
    "over",
    [{"iss": "https://evil.supabase.co/auth/v1"}, {"aud": "anon"}, {"exp": int(time.time()) - 120}],
)
def test_rejects_wrong_claims(keypair, over):
    with pytest.raises(auth.HTTPException) as err:
        auth.verify_user_jwt(token(keypair, **over), settings())
    assert err.value.status_code == 401


def test_rejects_other_key(keypair):
    other = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(auth.HTTPException):
        auth.verify_user_jwt(token(other), settings())
