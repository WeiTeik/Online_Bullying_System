"""
Lightweight in-memory two-factor challenge store.

This module manages short-lived verification codes that are issued to
users who are required to complete an additional authentication step.
Codes are generated as 6-digit strings, hashed before persisting in the
process-local store, and expire automatically after a configurable TTL.
"""

from __future__ import annotations

import hashlib
import secrets
import string
import time
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Iterable, Tuple

DEFAULT_CODE_LENGTH = 6
CHALLENGE_TTL_SECONDS = 10 * 60  # 10 minutes
MAX_ATTEMPTS = 5


class TwoFactorError(Exception):
    """Base class for two-factor related errors."""


class TwoFactorInvalidError(TwoFactorError):
    """Raised when a challenge id or code is invalid."""


class TwoFactorExpiredError(TwoFactorError):
    """Raised when a challenge has expired."""


class TwoFactorTooManyAttemptsError(TwoFactorError):
    """Raised when the user exceeded the maximum number of attempts."""


@dataclass
class TwoFactorChallenge:
    user_id: int
    code_hash: str
    expires_at: float
    attempts: int = 0

    def is_expired(self, now: float | None = None) -> bool:
        current = time.time() if now is None else now
        return current >= self.expires_at


_LOCK = Lock()
_CHALLENGES: Dict[str, TwoFactorChallenge] = {}


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_code(length: int = DEFAULT_CODE_LENGTH) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(max(1, length)))


def cleanup_expired_challenges(now: float | None = None) -> None:
    """Remove all expired challenges from the in-memory store."""
    current = time.time() if now is None else now
    with _LOCK:
        expired: Iterable[str] = [
            challenge_id
            for challenge_id, challenge in _CHALLENGES.items()
            if challenge.expires_at <= current
        ]
        for challenge_id in expired:
            _CHALLENGES.pop(challenge_id, None)


def invalidate_two_factor_challenge(challenge_id: str) -> None:
    with _LOCK:
        _CHALLENGES.pop(challenge_id, None)


def invalidate_user_challenges(user_id: int) -> None:
    with _LOCK:
        stale = [cid for cid, challenge in _CHALLENGES.items() if challenge.user_id == user_id]
        for cid in stale:
            _CHALLENGES.pop(cid, None)


def create_two_factor_challenge(
    user_id: int,
    *,
    ttl_seconds: int = CHALLENGE_TTL_SECONDS,
    code_length: int = DEFAULT_CODE_LENGTH,
) -> Tuple[str, str]:
    """
    Create a new two-factor challenge for the given user.

    Returns a tuple of (challenge_id, plain_code).  The caller is
    responsible for delivering the code to the user (e.g. via email or SMS).
    """
    cleanup_expired_challenges()
    invalidate_user_challenges(user_id)

    challenge_id = secrets.token_urlsafe(32)
    code = _generate_code(code_length)
    code_hash = _hash_code(code)
    expires_at = time.time() + max(30, ttl_seconds)  # minimum validity of 30 seconds

    with _LOCK:
        _CHALLENGES[challenge_id] = TwoFactorChallenge(
            user_id=user_id,
            code_hash=code_hash,
            expires_at=expires_at,
            attempts=0,
        )

    return challenge_id, code


def verify_two_factor_code(challenge_id: str, submitted_code: str) -> int:
    """
    Verify the submitted code. Returns the associated user_id on success.
    Raises a relevant TwoFactorError subclass on failure.
    """
    if not challenge_id:
        raise TwoFactorInvalidError("Missing challenge identifier.")
    if not submitted_code:
        raise TwoFactorInvalidError("Missing verification code.")

    cleanup_expired_challenges()

    with _LOCK:
        challenge = _CHALLENGES.get(challenge_id)
        if not challenge:
            raise TwoFactorInvalidError("Verification challenge not found.")

        now = time.time()
        if challenge.is_expired(now):
            _CHALLENGES.pop(challenge_id, None)
            raise TwoFactorExpiredError("Verification code has expired. Please request a new one.")

        if challenge.attempts >= MAX_ATTEMPTS:
            _CHALLENGES.pop(challenge_id, None)
            raise TwoFactorTooManyAttemptsError("Too many incorrect attempts. Please request a new code.")

        expected_hash = challenge.code_hash
        submitted_hash = _hash_code(submitted_code.strip())

        if expected_hash != submitted_hash:
            challenge.attempts += 1
            if challenge.attempts >= MAX_ATTEMPTS:
                _CHALLENGES.pop(challenge_id, None)
                raise TwoFactorTooManyAttemptsError("Too many incorrect attempts. Please request a new code.")
            _CHALLENGES[challenge_id] = challenge
            raise TwoFactorInvalidError("Incorrect verification code.")

        user_id = challenge.user_id
        _CHALLENGES.pop(challenge_id, None)

    return user_id

