import base64
import binascii
import hashlib
import json
import os
import re
import secrets
import time
from collections import deque
from threading import Lock
from html import escape as html_escape
from flask import Blueprint, jsonify, request, current_app, send_from_directory
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.utils import secure_filename
from app.models import User, UserStatus, UserRole, db, now_kuala_lumpur
from app.crud.user import get_all_users, get_user_by_id, create_user, update_user, delete_user
from app.crud.complaint import (
    create_complaint,
    get_complaints_for_user,
    get_all_complaints,
    add_comment,
    get_complaint_by_id,
    get_complaint_by_reference_code,
    get_comments,
    update_complaint_status,
)
from app.crud.student import (
    list_students,
    invite_student,
    update_student,
    reset_student_password,
    remove_student,
    StudentInviteError,
    StudentDataError,
    StudentNotFoundError,
)
from app.crud.admins import (
    invite_admin,
    AdminInviteError,
    AdminDataError,
)
from app.utils.passwords import generate_strong_password, validate_password_strength
from app.utils.email import send_email
from app.utils.two_factor import (
    create_two_factor_challenge,
    verify_two_factor_code,
    cleanup_expired_challenges,
    invalidate_two_factor_challenge,
    TwoFactorError,
    TwoFactorExpiredError,
    TwoFactorInvalidError,
    TwoFactorTooManyAttemptsError,
)
from app.auth import issue_session, require_session, revoke_session, get_current_user
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

api_bp = Blueprint("api", __name__)


# Enforces API key header for API routes when configured.
@api_bp.before_request
def _require_api_key():
    """Reject requests missing the configured API key header."""
    if request.method == "OPTIONS":
        return None
    if request.path.startswith("/api/static/"):
        return None
    api_key = current_app.config.get("API_KEY")
    if not api_key:
        return None
    request_key = request.headers.get("X-API-Key")
    if not request_key:
        return jsonify({"error": "missing_api_key"}), 401
    try:
        if not secrets.compare_digest(request_key, api_key):
            return jsonify({"error": "invalid_api_key"}), 401
    except TypeError:
        # secrets.compare_digest raises if the inputs are different types
        return jsonify({"error": "invalid_api_key"}), 401
    return None


_COMPLAINT_RATE_LIMIT_WINDOW_SECONDS = 60  # 1 minute sliding window
_COMPLAINT_RATE_LIMIT_MAX_REQUESTS = 5
_COMPLAINT_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = {}
_COMPLAINT_RATE_LIMIT_LOCK = Lock()

_COMPLAINT_DUPLICATE_WINDOW_SECONDS = 60 * 30  # 30 minutes
_COMPLAINT_FINGERPRINTS: dict[str, float] = {}
_COMPLAINT_FINGERPRINT_LOCK = Lock()

_LOGIN_ATTEMPT_WINDOW_SECONDS = 60 * 5  # 5 minutes
_LOGIN_ATTEMPT_MAX_ATTEMPTS = 5
_LOGIN_LOCK_DURATION_SECONDS = 60 * 15  # 15 minutes lockout
_LOGIN_ATTEMPT_BUCKETS: dict[str, deque[float]] = {}
_LOGIN_LOCKED_UNTIL: dict[str, float] = {}
_LOGIN_ATTEMPT_LOCK = Lock()

_SUSPICIOUS_CONTENT_PATTERNS = (
    re.compile(r"<\s*script", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on\w+\s*=", re.IGNORECASE),
    re.compile(r"document\.cookie", re.IGNORECASE),
    re.compile(r"window\.location", re.IGNORECASE),
)


# Derives a client identifier using forwarded headers or remote address.
def _extract_client_identifier() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.remote_addr or "unknown"


# Applies a sliding-window rate limit to complaint submissions.
def _enforce_complaint_rate_limit():
    payload = request.get_json(silent=True) or {}
    identifiers = {f"ip:{_extract_client_identifier()}"}
    user_id = payload.get("user_id")
    if user_id:
        identifiers.add(f"user:{user_id}")

    now = time.time()
    retry_after = 0
    with _COMPLAINT_RATE_LIMIT_LOCK:
        for identifier in identifiers:
            bucket = _COMPLAINT_RATE_LIMIT_BUCKETS.setdefault(identifier, deque())
            while bucket and now - bucket[0] > _COMPLAINT_RATE_LIMIT_WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= _COMPLAINT_RATE_LIMIT_MAX_REQUESTS:
                retry_after = max(
                    retry_after,
                    int(max(1, _COMPLAINT_RATE_LIMIT_WINDOW_SECONDS - (now - bucket[0]))),
                )
            else:
                bucket.append(now)
    if retry_after:
        return True, {
            "error": "rate_limited",
            "message": "Too many complaints submitted. Please wait before submitting another report.",
            "retry_after": retry_after,
        }
    return False, None


# Normalizes payload values to trimmed single-space strings.
def _normalize_payload_value(value: object) -> str:
    if value is None:
        return ""
    normalized = str(value).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


# Computes a deterministic fingerprint of complaint payloads for duplication checks.
def _fingerprint_complaint_payload(payload):
    normalized = {
        "anonymous": bool(payload.get("anonymous")),
        "student_name": _normalize_payload_value(payload.get("student_name")).lower(),
        "incident_type": _normalize_payload_value(
            payload.get("incident_type") or payload.get("incidentType")
        ).lower(),
        "description": _normalize_payload_value(payload.get("description")).lower(),
        "room_number": _normalize_payload_value(
            payload.get("room_number") or payload.get("roomNumber")
        ).lower(),
        "incident_date": _normalize_payload_value(
            payload.get("incident_date") or payload.get("incidentDate")
        ),
        "witnesses": _normalize_payload_value(payload.get("witnesses")).lower(),
        "anonymous_flag": bool(payload.get("anonymous")),
    }

    attachments = payload.get("attachments")
    attachment_fingerprint: list[str] = []
    if isinstance(attachments, list):
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            name = _normalize_payload_value(attachment.get("name")).lower()
            size = attachment.get("size")
            try:
                size_value = int(size)
            except (TypeError, ValueError):
                size_value = 0
            attachment_fingerprint.append(f"{name}:{size_value}")
    if attachment_fingerprint:
        attachment_fingerprint.sort()
    normalized["attachments"] = attachment_fingerprint

    serialized = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


# Checks if a complaint payload matches a recent submission.
def _check_duplicate_complaint(payload):
    fingerprint = None
    if not isinstance(payload, dict):
        return False, fingerprint
    fingerprint = _fingerprint_complaint_payload(payload)
    now = time.time()
    with _COMPLAINT_FINGERPRINT_LOCK:
        expired = [
            key
            for key, timestamp in _COMPLAINT_FINGERPRINTS.items()
            if now - timestamp > _COMPLAINT_DUPLICATE_WINDOW_SECONDS
        ]
        for key in expired:
            _COMPLAINT_FINGERPRINTS.pop(key, None)
        if fingerprint in _COMPLAINT_FINGERPRINTS:
            return True, fingerprint
    return False, fingerprint


# Registers a fingerprint so future duplicates can be detected.
def _register_complaint_fingerprint(fingerprint):
    if not fingerprint:
        return
    now = time.time()
    with _COMPLAINT_FINGERPRINT_LOCK:
        _COMPLAINT_FINGERPRINTS[fingerprint] = now


# Tracks login attempts and enforces lockouts when thresholds are exceeded.
def _check_login_rate_limit(identifier: str | None) -> tuple[bool, int | None]:
    now = time.time()
    keys = {f"ip:{_extract_client_identifier()}"}
    if identifier:
        keys.add(f"id:{identifier.strip().lower()}")
    with _LOGIN_ATTEMPT_LOCK:
        for key in keys:
            locked_until = _LOGIN_LOCKED_UNTIL.get(key)
            if locked_until and now < locked_until:
                return False, int(max(1, locked_until - now))

        for key in keys:
            bucket = _LOGIN_ATTEMPT_BUCKETS.setdefault(key, deque())
            while bucket and now - bucket[0] > _LOGIN_ATTEMPT_WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= _LOGIN_ATTEMPT_MAX_ATTEMPTS:
                lock_until = now + _LOGIN_LOCK_DURATION_SECONDS
                for lock_key in keys:
                    existing = _LOGIN_LOCKED_UNTIL.get(lock_key, 0)
                    _LOGIN_LOCKED_UNTIL[lock_key] = max(existing, lock_until)
                return False, int(_LOGIN_LOCK_DURATION_SECONDS)

        for key in keys:
            bucket = _LOGIN_ATTEMPT_BUCKETS.setdefault(key, deque())
            bucket.append(now)
    return True, None


# Clears login rate-limit counters for the given identifier/IP set.
def _reset_login_rate_limit(identifier: str | None) -> None:
    keys = {f"ip:{_extract_client_identifier()}"}
    if identifier:
        keys.add(f"id:{identifier.strip().lower()}")
    with _LOGIN_ATTEMPT_LOCK:
        for key in keys:
            _LOGIN_ATTEMPT_BUCKETS.pop(key, None)
            _LOGIN_LOCKED_UNTIL.pop(key, None)


# Determines if a user should be prompted for two-factor verification.
def _requires_two_factor(user: User) -> bool:
    if not user:
        return True
    role_value = str(getattr(user.role, "value", user.role) or "").replace("_", " ").strip().upper()
    if role_value in {"ADMIN", "SUPER ADMIN"}:
        return True
    if user.last_login_at is None:
        return True
    if user.two_factor_verified_at is None:
        return True
    return False


# Checks whether the given user has admin-level privileges.
def _is_admin(user: User | None) -> bool:
    if not user:
        return False
    role_value = str(getattr(user.role, "value", user.role) or "").replace("_", " ").strip().upper()
    return role_value in {"ADMIN", "SUPER ADMIN"}


# Scans complaint fields for suspicious script-like content.
def _detect_suspicious_complaint_content(payload):
    suspicious_fields = []
    if not isinstance(payload, dict):
        return suspicious_fields

    fields_to_check = (
        "student_name",
        "incident_type",
        "incidentType",
        "description",
        "room_number",
        "roomNumber",
        "witnesses",
        "notes",
    )
    for field in fields_to_check:
        value = payload.get(field)
        if not isinstance(value, str):
            continue
        trimmed = value.strip()
        for pattern in _SUSPICIOUS_CONTENT_PATTERNS:
            if pattern.search(trimmed):
                suspicious_fields.append(field)
                break
    attachments = payload.get("attachments")
    if isinstance(attachments, list):
        for index, attachment in enumerate(attachments):
            if not isinstance(attachment, dict):
                continue
            name = attachment.get("name")
            if isinstance(name, str):
                for pattern in _SUSPICIOUS_CONTENT_PATTERNS:
                    if pattern.search(name):
                        suspicious_fields.append(f"attachments[{index}].name")
                        break
    return suspicious_fields


# Applies rate limiting specifically to complaint POST submissions.
@api_bp.before_request
def _protect_complaint_submission():
    if request.method != "POST":
        return None
    normalized_path = request.path or ""
    if normalized_path.rstrip("/") != "/api/complaints":
        return None
    limited, payload = _enforce_complaint_rate_limit()
    if limited and payload:
        retry_after = payload.pop("retry_after", None)
        response = jsonify(payload)
        response.status_code = 429
        if retry_after:
            response.headers["Retry-After"] = str(retry_after)
        return response
    return None


PASSWORD_RESET_STAGE_TTL_SECONDS = 10 * 60  # 10 minutes
_PASSWORD_RESET_TOKENS: dict[str, tuple[int, float]] = {}
_PASSWORD_RESET_LOCK = Lock()


# Removes expired password reset tokens from the in-memory store.
def _cleanup_password_reset_tokens(now: float | None = None) -> None:
    current = time.time() if now is None else now
    with _PASSWORD_RESET_LOCK:
        expired = [
            token
            for token, (_, expires_at) in _PASSWORD_RESET_TOKENS.items()
            if expires_at <= current
        ]
        for token in expired:
            _PASSWORD_RESET_TOKENS.pop(token, None)


# Generates and stores a temporary password reset token for a user.
def _create_password_reset_token(user_id: int) -> tuple[str, int]:
    _cleanup_password_reset_tokens()
    token = secrets.token_urlsafe(48)
    expires_at = time.time() + PASSWORD_RESET_STAGE_TTL_SECONDS
    with _PASSWORD_RESET_LOCK:
        stale_tokens = [
            existing_token
            for existing_token, (existing_user_id, _) in _PASSWORD_RESET_TOKENS.items()
            if existing_user_id == user_id
        ]
        for stale_token in stale_tokens:
            _PASSWORD_RESET_TOKENS.pop(stale_token, None)
        _PASSWORD_RESET_TOKENS[token] = (user_id, expires_at)
    return token, PASSWORD_RESET_STAGE_TTL_SECONDS


# Retrieves the user associated with a reset token, handling expiration.
def _get_password_reset_user(token: str) -> tuple[int | None, str | None]:
    if not token:
        return None, "invalid"
    now = time.time()
    with _PASSWORD_RESET_LOCK:
        entry = _PASSWORD_RESET_TOKENS.get(token)
        if not entry:
            return None, "invalid"
        user_id, expires_at = entry
        if now >= expires_at:
            _PASSWORD_RESET_TOKENS.pop(token, None)
            return None, "expired"
        return user_id, None


# Consumes and removes a password reset token.
def _consume_password_reset_token(token: str) -> None:
    with _PASSWORD_RESET_LOCK:
        _PASSWORD_RESET_TOKENS.pop(token, None)


# Chooses the best human-friendly name to display for a user.
def _user_display_name(user: User) -> str:
    for candidate in (user.full_name, user.username, user.email):
        candidate = (candidate or "").strip()
        if candidate:
            return candidate
    return "YouMatter User"


# Masks an email for display by obscuring the local part.
def _mask_email(email: str) -> str:
    if not email:
        return ""
    email = email.strip()
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if not local:
        return f"*@{domain}"
    if len(local) == 1:
        masked_local = local[0] + "***"
    elif len(local) == 2:
        masked_local = f"{local[0]}*{local[1]}"
    else:
        masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"
    return f"{masked_local}@{domain}"


# Sends a temporary password email to the user with text and HTML bodies.
def _send_password_reset_email(user: User, temporary_password: str) -> None:
    display_name = _user_display_name(user)
    email = (user.email or "").strip()
    login_url = current_app.config.get("PORTAL_LOGIN_URL")
    login_line = f"Login here: {login_url}" if login_url else ""

    text_lines = [
        f"Hi {display_name},",
        "",
        "We received a request to reset your YouMatter portal password.",
        "Use the temporary password below to sign in:",
        f"Email: {email}",
        f"Temporary Password: {temporary_password}",
        "",
        "Please change your password immediately after logging in.",
        login_line,
        "",
        "If you did not request this reset, please contact your administrator right away.",
        "",
        "Regards,",
        "YouMatter Support Team",
    ]
    text_body = "\n".join(line for line in text_lines if line)

    safe_display_name = html_escape(display_name)
    safe_email = html_escape(email)
    safe_password = html_escape(temporary_password)
    safe_login_url = html_escape(login_url) if login_url else None

    html_lines = [
        f"<p>Hi {safe_display_name},</p>",
        "<p>We received a request to reset your YouMatter portal password.</p>",
        "<p>Use the temporary credentials below to sign in:</p>",
        "<ul>",
        f"  <li><strong>Email:</strong> {safe_email}</li>",
        f"  <li><strong>Temporary Password:</strong> {safe_password}</li>",
        "</ul>",
        "<p>Please change your password immediately after logging in.</p>",
    ]
    if safe_login_url:
        html_lines.append(f'<p><a href="{safe_login_url}">Click here to sign in</a></p>')
    html_lines.extend(
        [
            "<p>If you did not request this reset, please contact your administrator right away.</p>",
            "<p>Regards,<br/>YouMatter Support Team</p>",
        ]
    )
    html_body = "\n".join(html_lines)

    send_email("YouMatter Temporary Password", email, text_body, html_body=html_body)


# Sends a two-factor verification code email to the user.
def _send_two_factor_code_email(user: User, verification_code: str) -> None:
    display_name = _user_display_name(user)
    email = (user.email or "").strip()
    if not email:
        raise RuntimeError("User record is missing an email address; unable to send verification code.")

    login_url = current_app.config.get("PORTAL_LOGIN_URL")
    login_line = f"Login here: {login_url}" if login_url else ""

    text_lines = [
        f"Hi {display_name},",
        "",
        "For security purposes, we need to confirm it's really you.",
        "Enter the six-digit verification code below to complete your sign-in:",
        "",
        f"Verification Code: {verification_code}",
        "",
        "This code will expire in 10 minutes. If you did not attempt to sign in, please contact your administrator immediately.",
        login_line,
        "",
        "Regards,",
        "YouMatter Security Team",
    ]
    text_body = "\n".join(line for line in text_lines if line)

    safe_display_name = html_escape(display_name)
    safe_code = html_escape(verification_code)
    safe_login_url = html_escape(login_url) if login_url else None

    html_lines = [
        f"<p>Hi {safe_display_name},</p>",
        "<p>For security purposes, we need to confirm it's really you.</p>",
        "<p>Enter the six-digit code below to complete your sign-in:</p>",
        f"<p style=\"font-size: 1.5rem; font-weight: bold; letter-spacing: 0.2rem;\">{safe_code}</p>",
        "<p>This code will expire in 10 minutes.</p>",
    ]
    if safe_login_url:
        html_lines.append(f'<p><a href="{safe_login_url}">Return to the YouMatter portal</a></p>')
    html_lines.extend(
        [
            "<p>If you did not attempt to sign in, please contact your administrator immediately.</p>",
            "<p>Regards,<br/>YouMatter Security Team</p>",
        ]
    )
    html_body = "\n".join(html_lines)

    send_email("Your YouMatter verification code", email, text_body, html_body=html_body)


# Finalizes a login, updating user metadata and issuing a session token.
def _complete_login_success(user: User, *, mark_two_factor_verified: bool = False):
    updated = False
    if (user.status or "").lower() == UserStatus.PENDING.value:
        user.status = UserStatus.ACTIVE.value
        updated = True
    now = now_kuala_lumpur()
    user.last_login_at = now
    updated = True
    if mark_two_factor_verified:
        user.two_factor_verified_at = now
        updated = True
    if updated:
        db.session.commit()
    session_payload = issue_session(
        user,
        ip_address=_extract_client_identifier(),
        user_agent=request.headers.get("User-Agent"),
    )
    return {
        "user": user.to_dict(),
        "session": session_payload,
    }


# Lists all users (admin or super admin required).
@api_bp.route("/users", methods=["GET"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_get_users():
    users = get_all_users()
    return jsonify(users), 200


# Returns a specific user if requester is self or admin.
@api_bp.route("/users/<int:user_id>", methods=["GET"])
@require_session()
def api_get_user(user_id):
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if current_user.id != user_id and not _is_admin(current_user):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(user), 200


# Creates a new user account (admin-only).
@api_bp.route("/users", methods=["POST"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_create_user():
    data = request.get_json() or {}
    result = create_user(data)
    # create_user may return (error_obj, status) or user dict
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 201


# Updates a user profile (self or admin).
@api_bp.route("/users/<int:user_id>", methods=["PUT"])
@require_session()
def api_update_user(user_id):
    data = request.get_json() or {}
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if current_user.id != user_id and not _is_admin(current_user):
        return jsonify({"error": "Forbidden"}), 403
    result = update_user(user_id, data)
    if result is None:
        return jsonify({"error": "User not found"}), 404
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 200


# Deletes a user (admin-only).
@api_bp.route("/users/<int:user_id>", methods=["DELETE"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_delete_user(user_id):
    ok = delete_user(user_id)
    if not ok:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"success": True}), 200


# Lists all students (admin-only).
@api_bp.route("/admin/students", methods=["GET"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_list_students():
    try:
        students = list_students()
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify(students), 200


# Invites a student and returns temporary credentials (admin-only).
@api_bp.route("/admin/students", methods=["POST"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_invite_student():
    data = request.get_json() or {}
    full_name = data.get("full_name") or data.get("name")
    email = data.get("email")
    try:
        student, temporary_password = invite_student(full_name, email)
    except StudentInviteError as exc:
        return jsonify({"error": str(exc)}), 400
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Failed to invite student: %s", exc)
        return jsonify({"error": "Unable to invite student at this time."}), 500
    return jsonify({"student": student, "temporary_password": temporary_password}), 201


# Updates student info (admin-only).
@api_bp.route("/admin/students/<int:student_id>", methods=["PATCH"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_update_student(student_id):
    data = request.get_json() or {}
    full_name = data.get("full_name") or data.get("name")
    email = data.get("email")
    try:
        student = update_student(student_id, full_name, email)
    except StudentNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except StudentInviteError as exc:
        return jsonify({"error": str(exc)}), 400
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify(student), 200


# Resets a student's password and returns the temporary password (admin-only).
@api_bp.route("/admin/students/<int:student_id>/reset_password", methods=["POST"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_reset_student_password(student_id):
    try:
        student, temporary_password = reset_student_password(student_id)
    except StudentNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except StudentInviteError as exc:
        return jsonify({"error": str(exc)}), 400
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify({"student": student, "temporary_password": temporary_password}), 200


# Removes a student account (admin-only).
@api_bp.route("/admin/students/<int:student_id>", methods=["DELETE"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_remove_student(student_id):
    try:
        remove_student(student_id)
    except StudentNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify({"success": True}), 200


# Invites an admin or super admin (admin-only).
@api_bp.route("/admin/admins", methods=["POST"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_invite_admin():
    data = request.get_json() or {}
    full_name = data.get("full_name") or data.get("name")
    email = data.get("email")
    role = data.get("role") or "ADMIN"
    try:
        admin, temporary_password = invite_admin(full_name, email, role)
    except AdminInviteError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminDataError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Failed to invite admin: %s", exc)
        return jsonify({"error": "Unable to invite administrator at this time."}), 500
    return jsonify({"admin": admin, "temporary_password": temporary_password}), 201


# Returns complaints list (filtered by user unless admin).
@api_bp.route("/complaints", methods=["GET"])
@require_session()
def api_get_complaints():
    user_id = request.args.get("user_id", type=int)
    include_comments = request.args.get("include_comments", "false").lower() == "true"
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if _is_admin(current_user):
        if user_id:
            complaints = get_complaints_for_user(user_id, include_comments=include_comments)
        else:
            complaints = get_all_complaints(include_comments=include_comments)
    else:
        complaints = get_complaints_for_user(current_user.id, include_comments=include_comments)
    return jsonify(complaints), 200


# Fetches a complaint by numeric id or reference code.
@api_bp.route("/complaints/<complaint_identifier>", methods=["GET"])
def api_get_complaint(complaint_identifier):
    identifier = (complaint_identifier or "").strip()
    complaint = None
    if identifier.isdigit():
        complaint = get_complaint_by_id(int(identifier), include_comments=True)
    else:
        complaint = get_complaint_by_reference_code(
            identifier,
            include_comments=True,
        )
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify(complaint), 200


# Creates a new complaint submission with duplicate and content checks.
@api_bp.route("/complaints", methods=["POST"])
def api_create_complaint():
    data = request.get_json() or {}
    suspicious_fields = _detect_suspicious_complaint_content(data)
    if suspicious_fields:
        return (
            jsonify(
                {
                    "error": "invalid_content",
                    "message": "Complaint submission rejected due to suspicious content.",
                    "fields": suspicious_fields,
                }
            ),
            400,
        )

    is_duplicate, fingerprint = _check_duplicate_complaint(data)
    if is_duplicate:
        return (
            jsonify(
                {
                    "error": "duplicate_submission",
                    "message": "An identical complaint was recently submitted. "
                    "Please wait or include additional details before submitting again.",
                }
            ),
            409,
        )

    try:
        complaint = create_complaint(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # broad but ensures we return json
        current_app.logger.exception("Failed to create complaint: %s", exc)
        return jsonify({"error": "Unable to create complaint"}), 400
    _register_complaint_fingerprint(fingerprint)
    return jsonify(complaint.to_dict(include_comments=True)), 201


# Retrieves comments for a complaint (restricted to owners/admins).
@api_bp.route("/complaints/<int:complaint_id>/comments", methods=["GET"])
@require_session()
def api_get_complaint_comments(complaint_id):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if not _is_admin(current_user):
        if complaint.user_id is None or complaint.user_id != current_user.id:
            return jsonify({"error": "Forbidden"}), 403
    comments = get_comments(complaint_id)
    return jsonify(comments), 200


# Adds a comment to a complaint for permitted users.
@api_bp.route("/complaints/<int:complaint_id>/comments", methods=["POST"])
@require_session()
def api_add_comment(complaint_id):
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Comment message is required."}), 400
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404
    if not _is_admin(current_user):
        if complaint.user_id is None or complaint.user_id != current_user.id:
            return jsonify({"error": "Forbidden"}), 403
    comment = add_comment(
        complaint_id=complaint_id,
        author_id=current_user.id,
        message=message,
    )
    if comment is None:
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify(comment.to_dict()), 201


# Updates a complaint status (admin-only).
@api_bp.route("/complaints/<int:complaint_id>/status", methods=["PATCH"])
@require_session(roles={"ADMIN", "SUPER ADMIN"})
def api_update_complaint_status(complaint_id):
    data = request.get_json() or {}
    status_value = data.get("status")
    if not status_value:
        return jsonify({"error": "Status value is required."}), 400
    try:
        complaint = update_complaint_status(complaint_id, status_value)
    except ValueError:
        return jsonify({"error": "Invalid status value."}), 400
    if complaint is None:
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify(complaint.to_dict(include_comments=True)), 200


# Changes a user's password after validating ownership and strength.
@api_bp.route("/users/<int:user_id>/password", methods=["POST"])
@require_session()
def api_change_password(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if current_user.id != user_id and not _is_admin(current_user):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"error": "Both old and new passwords are required."}), 400

    if not user.check_password(old_password):
        return jsonify({"error": "Old password is incorrect."}), 400

    validation_error = validate_password_strength(new_password, user=user)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    if new_password == old_password:
        return jsonify({"error": "New password must be different from the old password."}), 400

    user.set_password(new_password)
    user.two_factor_verified_at = None
    db.session.commit()
    return jsonify({"success": True, "message": "Password updated successfully."}), 200


# Initiates a forgot-password flow by sending a temporary password.
@api_bp.route("/auth/forgot-password", methods=["POST"])
def api_forgot_password():
    data = request.get_json() or {}
    email_input = (data.get("email") or "").strip()
    if not email_input:
        return jsonify({"error": "Email is required."}), 400

    normalized_email = email_input.lower()
    user = User.query.filter(func.lower(User.email) == normalized_email).first()
    if not user:
        return jsonify({"error": "No account found for this email."}), 404

    temporary_password = generate_strong_password(12)
    user.set_password(temporary_password)
    user.last_login_at = None
    if (user.status or "").lower() == UserStatus.PENDING.value:
        user.status = UserStatus.ACTIVE.value

    try:
        db.session.flush()
    except SQLAlchemyError as exc:
        current_app.logger.exception("Failed to persist password reset for %s: %s", user.email, exc)
        db.session.rollback()
        return jsonify({"error": "Unable to reset password at this time."}), 503

    try:
        _send_password_reset_email(user, temporary_password)
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Failed to send password reset email to %s: %s", user.email, exc)
        db.session.rollback()
        return jsonify({"error": "Unable to send temporary password email. Please try again later."}), 503

    db.session.commit()
    return jsonify({"success": True, "message": "Temporary password has been emailed to you."}), 200


# Handles username/email + password login and triggers 2FA when required.
@api_bp.route("/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    identifier = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password")
    if not identifier or not password:
        # also print to stdout so you see it in the terminal
        print(f"Login attempt with missing credentials from {request.remote_addr}")
        current_app.logger.warning("Login attempt with missing credentials from %s", request.remote_addr)
        return jsonify({"error": "Missing credentials"}), 400

    allowed, retry_after = _check_login_rate_limit(identifier)
    if not allowed:
        message = "Too many login attempts. Please try again later."
        response = {"error": message}
        if retry_after:
            response["retry_after_seconds"] = retry_after
        return jsonify(response), 429

    # try by email then username
    user = User.query.filter((User.email == identifier) | (User.username == identifier)).first()
    if not user:
        print(f"Login failed: user not found for identifier='{identifier}' from {request.remote_addr}")
        current_app.logger.info("Login failed: user not found for identifier='%s' from %s", identifier, request.remote_addr)
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.check_password(password):
        print(f"Login failed: bad password for user id={user.id} username={user.username} from {request.remote_addr}")
        current_app.logger.info("Login failed: bad password for user id=%s username=%s from %s", user.id, user.username, request.remote_addr)
        return jsonify({"error": "Invalid credentials"}), 401

    cleanup_expired_challenges()
    requires_two_factor = _requires_two_factor(user)
    must_reset_password = user.last_login_at is None

    if requires_two_factor:
        try:
            challenge_id, verification_code = create_two_factor_challenge(user.id)
        except Exception as exc:  # pylint: disable=broad-except
            current_app.logger.exception("Failed to create two-factor challenge for user %s: %s", user.id, exc)
            return jsonify({"error": "Unable to initiate two-factor verification. Please try again later."}), 503

        try:
            _send_two_factor_code_email(user, verification_code)
        except Exception as exc:  # pylint: disable=broad-except
            current_app.logger.exception("Failed to send verification code to %s: %s", user.email, exc)
            invalidate_two_factor_challenge(challenge_id)
            return jsonify({"error": "Unable to send verification code email. Please try again later."}), 503

        masked_email = _mask_email(user.email)
        current_app.logger.info(
            "Two-factor verification required for user id=%s username=%s from %s",
            user.id,
            user.username,
            request.remote_addr,
        )
        _reset_login_rate_limit(identifier)
        return (
            jsonify(
                {
                    "requires_two_factor": True,
                    "challenge_id": challenge_id,
                    "email": masked_email,
                    "expires_in": current_app.config.get("TWO_FACTOR_TTL_SECONDS", 10 * 60),
                    "requires_password_reset": bool(must_reset_password),
                    "message": "A verification code has been sent to your email address.",
                }
            ),
            200,
        )

    # success
    print(f"Login successful: user id={user.id} username={user.username} from {request.remote_addr}")
    current_app.logger.info(
        "Login successful: user id=%s username=%s from %s", user.id, user.username, request.remote_addr
    )
    _reset_login_rate_limit(identifier)
    login_payload = _complete_login_success(user, mark_two_factor_verified=False)
    return jsonify(login_payload), 200


# Completes Google OAuth login for registered users.
@api_bp.route("/auth/google", methods=["POST"])
def api_google_login():
    data = request.get_json() or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "Missing Google token"}), 400

    client_id = current_app.config.get("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        current_app.logger.error("Google Sign-In attempted but GOOGLE_CLIENT_ID is not configured.")
        return jsonify({"error": "Google Sign-In is not available."}), 503

    try:
        id_info = google_id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
    except ValueError as exc:
        current_app.logger.warning("Invalid Google ID token: %s", exc)
        return jsonify({"error": "Invalid Google token"}), 401

    email = id_info.get("email")
    if not email:
        return jsonify({"error": "Google account is missing an email address."}), 400

    if not id_info.get("email_verified", True):
        return jsonify({"error": "Google email address is not verified."}), 403

    normalized_email = email.strip().lower()
    user = User.query.filter(func.lower(User.email) == normalized_email).first()
    if not user:
        current_app.logger.info("Google Sign-In blocked for unregistered email=%s", email)
        return (
            jsonify(
                {
                    "error": "No account found for this Google email. Please contact your administrator.",
                }
            ),
            403,
        )

    updated = False
    if (user.status or "").lower() == UserStatus.PENDING.value:
        user.status = UserStatus.ACTIVE.value
        updated = True
    if updated:
        current_app.logger.info("Google Sign-In activated pending account id=%s", user.id)

    payload = _complete_login_success(user, mark_two_factor_verified=True)
    return jsonify(payload), 200


# Verifies 2FA codes and optional password resets during login.
@api_bp.route("/auth/verify-2fa", methods=["POST"])
def api_verify_two_factor():
    data = request.get_json() or {}
    challenge_id = (data.get("challenge_id") or "").strip()
    code = (data.get("code") or "").strip()
    reset_token = (data.get("reset_token") or "").strip()
    new_password = (data.get("new_password") or "").strip()
    confirm_password = (data.get("confirm_password") or "").strip()

    if reset_token:
        user_id, token_error = _get_password_reset_user(reset_token)
        if token_error == "invalid":
            return jsonify({"error": "Password reset session not found. Please sign in again."}), 400
        if token_error == "expired":
            return jsonify({"error": "Password reset session expired. Please sign in again."}), 400
        if new_password != confirm_password:
            return jsonify({"error": "New password and confirmation do not match."}), 400
        if not new_password:
            return jsonify({"error": "New password is required."}), 400

        user = User.query.get(user_id)
        if not user:
            _consume_password_reset_token(reset_token)
            return jsonify({"error": "User account not found."}), 404

        validation_error = validate_password_strength(new_password, user=user)
        if validation_error:
            return jsonify({"error": validation_error}), 400
        if user.check_password(new_password):
            return jsonify({"error": "New password must be different from the temporary password."}), 400

        try:
            user.set_password(new_password)
            db.session.flush()
        except SQLAlchemyError as exc:
            db.session.rollback()
            current_app.logger.exception("Failed to persist password reset for user %s: %s", user.id, exc)
            return jsonify({"error": "Unable to update password at this time."}), 503

        print(
            f"Two-factor verification successful: user id={user.id} username={user.username} from {request.remote_addr}"
        )
        current_app.logger.info(
            "Two-factor verification successful: user id=%s username=%s from %s",
            user.id,
            user.username,
            request.remote_addr,
        )

        _reset_login_rate_limit(user.email or user.username)
        user_dict = _complete_login_success(user, mark_two_factor_verified=True)
        _consume_password_reset_token(reset_token)
        return jsonify(user_dict), 200

    if not challenge_id or not code:
        return jsonify({"error": "Verification code is required."}), 400

    try:
        user_id = verify_two_factor_code(challenge_id, code)
    except TwoFactorExpiredError as exc:
        return jsonify({"error": str(exc), "reason": "expired"}), 400
    except TwoFactorTooManyAttemptsError as exc:
        return jsonify({"error": str(exc), "reason": "locked"}), 400
    except TwoFactorInvalidError as exc:
        return jsonify({"error": str(exc), "reason": "invalid"}), 400
    except TwoFactorError as exc:  # pragma: no cover - catch-all safeguard
        current_app.logger.exception("Unexpected two-factor verification failure: %s", exc)
        return jsonify({"error": "Unable to verify the code at this time."}), 503

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User account not found."}), 404

    must_reset_password = user.last_login_at is None

    if new_password or confirm_password:
        if new_password != confirm_password:
            return jsonify({"error": "New password and confirmation do not match."}), 400
        validation_error = validate_password_strength(new_password, user=user)
        if validation_error:
            return jsonify({"error": validation_error}), 400
        if user.check_password(new_password):
            return jsonify({"error": "New password must be different from the temporary password."}), 400
        user.set_password(new_password)
        db.session.flush()
        must_reset_password = False

    if must_reset_password and not new_password:
        token, ttl_seconds = _create_password_reset_token(user.id)
        message = "Verification successful. Please set a new password to finish signing in."
        current_app.logger.info(
            "Two-factor code verified for user id=%s; awaiting password reset to complete login.", user.id
        )
        _reset_login_rate_limit(user.email or user.username)
        return (
            jsonify(
                {
                    "requires_password_reset": True,
                    "reset_token": token,
                    "expires_in": ttl_seconds,
                    "email": _mask_email(user.email),
                    "message": message,
                }
            ),
            200,
        )

    print(f"Two-factor verification successful: user id={user.id} username={user.username} from {request.remote_addr}")
    current_app.logger.info(
        "Two-factor verification successful: user id=%s username=%s from %s",
        user.id,
        user.username,
        request.remote_addr,
    )
    _reset_login_rate_limit(user.email or user.username)
    user_dict = _complete_login_success(user, mark_two_factor_verified=True)
    return jsonify(user_dict), 200


# Logs out by revoking the bearer session token.
@api_bp.route("/auth/logout", methods=["POST"])
@require_session()
def api_logout():
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if token:
        revoke_session(token)
    return jsonify({"success": True}), 200


# Determines an image extension from a data URL header.
def _detect_extension_from_header(header: str) -> str:
    header = (header or "").lower()
    if "jpeg" in header or "jpg" in header:
        return "jpg"
    if "gif" in header:
        return "gif"
    if "webp" in header:
        return "webp"
    return "png"


# Uploads and stores a user's avatar image.
@api_bp.route("/users/<int:user_id>/avatar", methods=["POST"])
@require_session()
def api_upload_avatar(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if current_user.id != user_id and not _is_admin(current_user):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json() or {}
    image_data = data.get("image")
    if not image_data:
        return jsonify({"error": "Missing image data"}), 400

    header, encoded = ("", image_data)
    if "," in image_data:
        header, encoded = image_data.split(",", 1)

    try:
        binary = base64.b64decode(encoded)
    except (binascii.Error, ValueError):
        return jsonify({"error": "Invalid image encoding"}), 400

    file_ext = _detect_extension_from_header(header)
    filename = secure_filename(f"user_{user_id}_{int(time.time())}.{file_ext}")

    upload_root = current_app.config.get("UPLOAD_FOLDER")
    avatar_subdir = current_app.config.get("AVATAR_SUBDIR", "avatars")
    if not upload_root:
        return jsonify({"error": "Upload folder not configured"}), 500

    target_dir = os.path.join(upload_root, avatar_subdir)
    os.makedirs(target_dir, exist_ok=True)

    file_path = os.path.join(target_dir, filename)
    with open(file_path, "wb") as fh:
        fh.write(binary)

    # remove previous avatar if it was stored in our managed directory
    if user.avatar_url and user.avatar_url.startswith("/api/static/avatars/"):
        old_filename = user.avatar_url.rsplit("/", 1)[-1]
        old_path = os.path.join(target_dir, old_filename)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                current_app.logger.warning("Failed to remove old avatar at %s", old_path)

    user.avatar_url = f"/api/static/avatars/{filename}"
    db.session.commit()

    return jsonify(user.to_dict()), 200


# Deletes a user's avatar (and removes managed file if present).
@api_bp.route("/users/<int:user_id>/avatar", methods=["DELETE"])
@require_session()
def api_delete_avatar(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "Unauthorized"}), 401
    if current_user.id != user_id and not _is_admin(current_user):
        return jsonify({"error": "Forbidden"}), 403

    upload_root = current_app.config.get("UPLOAD_FOLDER")
    avatar_subdir = current_app.config.get("AVATAR_SUBDIR", "avatars")
    target_dir = os.path.join(upload_root, avatar_subdir) if upload_root else None

    if user.avatar_url and user.avatar_url.startswith("/api/static/avatars/") and target_dir:
        old_filename = user.avatar_url.rsplit("/", 1)[-1]
        old_path = os.path.join(target_dir, old_filename)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                current_app.logger.warning("Failed to remove avatar at %s", old_path)

    user.avatar_url = None
    db.session.commit()
    return jsonify(user.to_dict()), 200


# Serves stored avatar files.
@api_bp.route("/static/avatars/<path:filename>", methods=["GET"])
def api_get_avatar(filename):
    upload_root = current_app.config.get("UPLOAD_FOLDER")
    avatar_subdir = current_app.config.get("AVATAR_SUBDIR", "avatars")
    if not upload_root:
        return jsonify({"error": "Upload folder not configured"}), 500

    target_dir = os.path.join(upload_root, avatar_subdir)
    return send_from_directory(target_dir, filename)


# Serves complaint attachment files by reference code.
@api_bp.route("/static/complaints/<reference_code>/<path:filename>", methods=["GET"])
def api_get_complaint_attachment(reference_code, filename):
    upload_root = current_app.config.get("UPLOAD_FOLDER")
    complaint_subdir = current_app.config.get("COMPLAINT_ATTACHMENT_SUBDIR", "complaints")
    if not upload_root:
        return jsonify({"error": "Upload folder not configured"}), 500

    safe_code = secure_filename(reference_code)
    if not safe_code:
        return jsonify({"error": "Invalid reference code"}), 400

    target_dir = os.path.join(upload_root, complaint_subdir, safe_code)
    if not os.path.isdir(target_dir):
        return jsonify({"error": "Attachment not found"}), 404

    download = request.args.get("download", "").strip().lower() in {"1", "true", "yes", "download"}
    return send_from_directory(target_dir, filename, as_attachment=download, conditional=True)
