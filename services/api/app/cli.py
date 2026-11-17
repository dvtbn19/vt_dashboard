"""Developer/admin CLI.

    python -m app.cli bootstrap --email you@example.com --project-slug ecommerce-sales-analysis \
        --project-name "E-Commerce Sales Analysis"

Creates (if missing) the user row, the project, and a new agent token scoped to that project, then
prints the token once. In Supabase mode the user must have signed in to the web app at least once
(so their Supabase user id is known); in local mode the deterministic local id is used.
"""

from __future__ import annotations

import argparse
import sys
from datetime import timedelta

from sqlalchemy import select

from app.auth import ALL_SCOPES, local_user_id, new_agent_token
from app.config import get_settings
from app.db import get_sessionmaker
from app.models import AgentCredential, Project, User, utcnow


def bootstrap(args: argparse.Namespace) -> int:
    settings = get_settings()
    email = args.email.strip().lower()
    db = get_sessionmaker()()
    try:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            if settings.auth_mode != "local":
                print(
                    f"No user with e-mail {email}. Sign in to the web app once, then rerun.", file=sys.stderr
                )
                return 1
            user = User(id=local_user_id(email), email=email)
            db.add(user)
            db.flush()
        project = db.scalar(select(Project).where(Project.slug == args.project_slug))
        if project is None:
            project = Project(
                owner_id=user.id,
                slug=args.project_slug,
                name=args.project_name or args.project_slug.replace("-", " ").title(),
                summary=args.project_summary or "",
                category=args.category,
            )
            db.add(project)
            db.flush()
            print(f"Created project {project.slug} ({project.id})")
        elif project.owner_id != user.id:
            print("That slug belongs to another user.", file=sys.stderr)
            return 1
        token, prefix, token_hash = new_agent_token()
        db.add(
            AgentCredential(
                owner_id=user.id,
                name=args.token_name,
                token_prefix=prefix,
                token_hash=token_hash,
                scopes=list(ALL_SCOPES),
                project_ids=[str(project.id)],
                expires_at=utcnow() + timedelta(days=args.days),
            )
        )
        db.commit()
        print(f"Project id: {project.id}")
        print(f"Agent token (shown once): {token}")
        return 0
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("bootstrap", help="Create user/project and issue a scoped agent token")
    b.add_argument("--email", required=True)
    b.add_argument("--project-slug", required=True)
    b.add_argument("--project-name")
    b.add_argument("--project-summary")
    b.add_argument("--category", default="eda")
    b.add_argument("--token-name", default="cli-bootstrap")
    b.add_argument("--days", type=int, default=30)
    args = parser.parse_args(argv)
    if args.cmd == "bootstrap":
        return bootstrap(args)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
