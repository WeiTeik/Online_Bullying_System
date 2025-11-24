"""
Persistent two-factor challenge store backed by the database.

Replaces the prior in-memory implementation so that challenges survive
application restarts and can operate in multi-worker deployments.
"""

import hashlib
import secrets
import string
from datetime import timedelta
from typing import Tuple

from flask import current_app

from app.models import TwoFactorChallengeModel, db, now_kuala_lumpur

DEFAULT_CODE_LENGTH = 6
DEFAULT_TTL_SECONDS = 10 * 60  # 10 minutes
DEFAULT_MAX_ATTEMPTS = 5


class TwoFactorError(Exception):
    """Base class for two-factor related errors."""


class TwoFactorInvalidError(TwoFactorError):
    """Raised when a challenge id or code is invalid."""


class TwoFactorExpiredError(TwoFactorError):
    """Raised when a challenge has expired."""


class TwoFactorTooManyAttemptsError(TwoFactorError):
    """Raised when the user exceeded the maximum number of attempts."""


# Returns a SHA-256 hash of the provided verification code.
def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


# Generates a numeric verification code of the requested length.
def _generate_code(length: int = DEFAULT_CODE_LENGTH) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(max(1, length)))


# Reads an integer setting from Flask config, falling back to a default on error.
def _config_seconds(name: str, default: int) -> int:
    value = current_app.config.get(name, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# Removes expired two-factor challenges from the database.
def cleanup_expired_challenges() -> None:
    """Remove expired challenges from the persistent store."""
    now = now_kuala_lumpur()
    expired = TwoFactorChallengeModel.query.filter(TwoFactorChallengeModel.expires_at <= now).all()
    if not expired:
        return
    for challenge in expired:
        db.session.delete(challenge)
    db.session.commit()


# Deletes a single challenge by its identifier if it exists.
def invalidate_two_factor_challenge(challenge_id: str) -> None:
    if not challenge_id:
        return
    challenge = TwoFactorChallengeModel.query.filter_by(challenge_id=challenge_id).first()
    if challenge:
        db.session.delete(challenge)
        db.session.commit()


# Deletes all existing challenges for a user before issuing a new one.
def invalidate_user_challenges(user_id: int) -> None:
    if not user_id:
        return
    challenges = TwoFactorChallengeModel.query.filter_by(user_id=user_id).all()
    if not challenges:
        return
    for challenge in challenges:
        db.session.delete(challenge)
    db.session.commit()


def create_two_factor_challenge(
    user_id: int,
    *,
    ttl_seconds: int | None = None,
    code_length: int | None = None,
) -> Tuple[str, str]:
    """
    Create and persist a new challenge for the user.

    Returns (challenge_id, verification_code).
    """
    cleanup_expired_challenges()
    invalidate_user_challenges(user_id)

    ttl = ttl_seconds or _config_seconds("TWO_FACTOR_TTL_SECONDS", DEFAULT_TTL_SECONDS)
    length = code_length or _config_seconds("TWO_FACTOR_CODE_LENGTH", DEFAULT_CODE_LENGTH)

    challenge_id = secrets.token_urlsafe(32)
    code = _generate_code(length)
    code_hash = _hash_code(code)
    expires_at = now_kuala_lumpur() + timedelta(seconds=max(30, ttl))

    challenge = TwoFactorChallengeModel(
        challenge_id=challenge_id,
        user_id=user_id,
        code_hash=code_hash,
        expires_at=expires_at,
        attempts=0,
    )
    db.session.add(challenge)
    db.session.commit()
    return challenge_id, code


# Validates a submitted code against stored challenge data, returning the user id on success.
def verify_two_factor_code(challenge_id: str, submitted_code: str) -> int:
    """
    Validate the submitted code and return the associated user id.
    Raises a TwoFactorError subclass on failure.
    """
    if not challenge_id:
        raise TwoFactorInvalidError("Missing challenge identifier.")
    if not submitted_code:
        raise TwoFactorInvalidError("Missing verification code.")

    cleanup_expired_challenges()
    challenge = TwoFactorChallengeModel.query.filter_by(challenge_id=challenge_id).first()
    if not challenge:
        raise TwoFactorInvalidError("Verification challenge not found.")

    now = now_kuala_lumpur()
    if challenge.expires_at <= now:
        db.session.delete(challenge)
        db.session.commit()
        raise TwoFactorExpiredError("Verification code has expired. Please request a new one.")

    max_attempts = _config_seconds("TWO_FACTOR_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS)
    if challenge.attempts >= max_attempts:
        db.session.delete(challenge)
        db.session.commit()
        raise TwoFactorTooManyAttemptsError("Too many incorrect attempts. Please request a new code.")

    submitted_hash = _hash_code(submitted_code.strip())
    if challenge.code_hash != submitted_hash:
        challenge.attempts += 1
        db.session.add(challenge)
        db.session.commit()
        if challenge.attempts >= max_attempts:
            db.session.delete(challenge)
            db.session.commit()
            raise TwoFactorTooManyAttemptsError("Too many incorrect attempts. Please request a new code.")
        raise TwoFactorInvalidError("Incorrect verification code.")

    user_id = challenge.user_id
    db.session.delete(challenge)
    db.session.commit()
    return user_id
