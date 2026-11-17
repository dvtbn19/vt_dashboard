"""Entrypoint for serverless hosts that look for `index.py` (e.g. Vercel's Python/FastAPI runtime)."""

from app.main import app

__all__ = ["app"]
