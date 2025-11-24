import hashlib
import secrets
from datetime import timedelta
from functools import wraps
from typing import Callable, Iterable, Optional

from flask import current_app, g, jsonify, request

from app.models import LoginSession, User, db, now_kuala_lumpur


# Returns a SHA-256 hash of a session token for storage/lookup.
def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# Reads an integer config value, falling back to a default when missing/invalid.
def _get_config_seconds(name: str, default: int) -> int:
    try:
        return int(current_app.config.get(name, default))
    except (TypeError, ValueError):
        return default


# Normalizes role strings to a consistent uppercase form.
def _normalize_role(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).replace("_", " ").replace("-", " ").strip().upper()


# Issues and persists a new login session, returning the raw token details.
def issue_session(user: User, *, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
    """
    Create a new session for the provided user and return the raw token payload.
    """
    now = now_kuala_lumpur()
    ttl_seconds = _get_config_seconds("SESSION_TTL_SECONDS", 60 * 60 * 12)
    expires_at = now + timedelta(seconds=ttl_seconds)
    idle_seconds = _get_config_seconds("SESSION_MAX_IDLE_SECONDS", 60 * 60 * 2)
    rotate_seconds = _get_config_seconds("SESSION_ROTATE_SECONDS", 60 * 60 * 6)

    token_bytes = max(32, _get_config_seconds("SESSION_TOKEN_BYTES", 48))
    raw_token = secrets.token_urlsafe(token_bytes)
    token_hash = _hash_token(raw_token)

    session = LoginSession(
        user_id=user.id,
        token_hash=token_hash,
        issued_at=now,
        expires_at=expires_at,
        last_seen_at=now,
        ip_address=ip_address[:64] if ip_address else None,
        user_agent=user_agent[:256] if user_agent else None,
    )
    db.session.add(session)
    db.session.commit()

    return {
        "token": raw_token,
        "issued_at": session.issued_at.isoformat(),
        "expires_at": session.expires_at.isoformat(),
        "idle_timeout_seconds": idle_seconds,
        "rotate_after_seconds": rotate_seconds,
    }


# Revokes an existing session identified by its raw token.
def revoke_session(token: str) -> None:
    if not token:
        return
    token_hash = _hash_token(token)
    session = LoginSession.query.filter_by(token_hash=token_hash).first()
    if session:
        session.revoked_at = now_kuala_lumpur()
        db.session.commit()


# Retrieves a valid session from a raw token, updating last-seen and idle expiry.
def _get_session_from_token(token: str) -> Optional[LoginSession]:
    if not token:
        return None
    token_hash = _hash_token(token)
    session = LoginSession.query.filter_by(token_hash=token_hash).first()
    if not session:
        return None
    now = now_kuala_lumpur()
    if session.revoked_at is not None:
        return None
    if session.expires_at and session.expires_at <= now:
        return None
    idle_seconds = _get_config_seconds("SESSION_MAX_IDLE_SECONDS", 60 * 60 * 2)
    last_seen = session.last_seen_at or session.issued_at
    if idle_seconds and (now - last_seen).total_seconds() > idle_seconds:
        session.revoked_at = now
        db.session.commit()
        return None
    session.last_seen_at = now
    db.session.commit()
    return session


# Extracts the bearer token from the Authorization header.
def _parse_bearer_token() -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return ""
    return auth_header.split(" ", 1)[1].strip()


# Decorator enforcing an authenticated session (optionally with role checks).
def require_session(*, roles: Optional[Iterable[str]] = None) -> Callable:
    """
    Decorator to enforce authenticated sessions on API routes.
    Optionally restricts access to the supplied roles (case-insensitive).
    """

    required_roles = None
    if roles:
        required_roles = {_normalize_role(role) for role in roles}

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            token = _parse_bearer_token()
            session = _get_session_from_token(token)
            if not session:
                return jsonify({"error": "Authentication required."}), 401

            user: Optional[User] = session.user
            if not user:
                return jsonify({"error": "Authentication required."}), 401

            if required_roles:
                normalized_role = _normalize_role(getattr(user.role, "value", user.role))
                if normalized_role not in required_roles:
                    return jsonify({"error": "Forbidden"}), 403

            g.current_user = user
            g.current_session = session
            return func(*args, **kwargs)

        return wrapper

    return decorator


# Returns the user attached to the current request context, if any.
def get_current_user() -> Optional[User]:
    return getattr(g, "current_user", None)
