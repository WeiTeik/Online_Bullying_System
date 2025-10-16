import base64
import binascii
import os
import re
import secrets
import time
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
from app.utils.passwords import generate_strong_password
from app.utils.email import send_email
from app.utils.two_factor import (
    create_two_factor_challenge,
    verify_two_factor_code,
    cleanup_expired_challenges,
    invalidate_two_factor_challenge,
    CHALLENGE_TTL_SECONDS,
    TwoFactorError,
    TwoFactorExpiredError,
    TwoFactorInvalidError,
    TwoFactorTooManyAttemptsError,
)
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

api_bp = Blueprint("api", __name__)


_USERNAME_SANITIZE_PATTERN = re.compile(r"[^a-zA-Z0-9._-]")


def _sanitize_username(value: str) -> str:
    value = (value or "").strip().lower()
    sanitized = _USERNAME_SANITIZE_PATTERN.sub("", value)
    sanitized = sanitized.strip("._-")
    return sanitized or "user"


def _user_display_name(user: User) -> str:
    for candidate in (user.full_name, user.username, user.email):
        candidate = (candidate or "").strip()
        if candidate:
            return candidate
    return "YouMatter User"


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


def _finalize_successful_login(user: User):
    updated = False
    if (user.status or "").lower() == UserStatus.PENDING.value:
        user.status = UserStatus.ACTIVE.value
        updated = True
    user.last_login_at = now_kuala_lumpur()
    updated = True
    if updated:
        db.session.commit()
    return user.to_dict()

@api_bp.route("/users", methods=["GET"])
def api_get_users():
    users = get_all_users()
    return jsonify(users), 200

@api_bp.route("/users/<int:user_id>", methods=["GET"])
def api_get_user(user_id):
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user), 200

@api_bp.route("/users", methods=["POST"])
def api_create_user():
    data = request.get_json() or {}
    result = create_user(data)
    # create_user may return (error_obj, status) or user dict
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 201

@api_bp.route("/users/<int:user_id>", methods=["PUT"])
def api_update_user(user_id):
    data = request.get_json() or {}
    result = update_user(user_id, data)
    if result is None:
        return jsonify({"error": "User not found"}), 404
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
    return jsonify(result), 200

@api_bp.route("/users/<int:user_id>", methods=["DELETE"])
def api_delete_user(user_id):
    ok = delete_user(user_id)
    if not ok:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"success": True}), 200


@api_bp.route("/admin/students", methods=["GET"])
def api_list_students():
    try:
        students = list_students()
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify(students), 200


@api_bp.route("/admin/students", methods=["POST"])
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


@api_bp.route("/admin/students/<int:student_id>", methods=["PATCH"])
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


@api_bp.route("/admin/students/<int:student_id>/reset_password", methods=["POST"])
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


@api_bp.route("/admin/students/<int:student_id>", methods=["DELETE"])
def api_remove_student(student_id):
    try:
        remove_student(student_id)
    except StudentNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except StudentDataError as exc:
        return jsonify({"error": str(exc)}), 503
    return jsonify({"success": True}), 200


@api_bp.route("/admin/admins", methods=["POST"])
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


@api_bp.route("/complaints", methods=["GET"])
def api_get_complaints():
    user_id = request.args.get("user_id", type=int)
    include_comments = request.args.get("include_comments", "false").lower() == "true"
    if user_id:
        complaints = get_complaints_for_user(user_id, include_comments=include_comments)
    else:
        complaints = get_all_complaints(include_comments=include_comments)
    return jsonify(complaints), 200


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


@api_bp.route("/complaints", methods=["POST"])
def api_create_complaint():
    data = request.get_json() or {}
    try:
        complaint = create_complaint(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:  # broad but ensures we return json
        current_app.logger.exception("Failed to create complaint: %s", exc)
        return jsonify({"error": "Unable to create complaint"}), 400
    return jsonify(complaint.to_dict(include_comments=True)), 201


@api_bp.route("/complaints/<int:complaint_id>/comments", methods=["GET"])
def api_get_complaint_comments(complaint_id):
    complaint = get_complaint_by_id(complaint_id)
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404
    comments = get_comments(complaint_id)
    return jsonify(comments), 200


@api_bp.route("/complaints/<int:complaint_id>/comments", methods=["POST"])
def api_add_comment(complaint_id):
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Comment message is required."}), 400
    comment = add_comment(
        complaint_id=complaint_id,
        author_id=data.get("author_id"),
        message=message,
    )
    if comment is None:
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify(comment.to_dict()), 201


@api_bp.route("/complaints/<int:complaint_id>/status", methods=["PATCH"])
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


@api_bp.route("/users/<int:user_id>/password", methods=["POST"])
def api_change_password(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"error": "Both old and new passwords are required."}), 400

    if not user.check_password(old_password):
        return jsonify({"error": "Old password is incorrect."}), 400

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters long."}), 400

    if new_password == old_password:
        return jsonify({"error": "New password must be different from the old password."}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"success": True, "message": "Password updated successfully."}), 200

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

@api_bp.route("/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    identifier = data.get("email") or data.get("username")
    password = data.get("password")
    if not identifier or not password:
        # also print to stdout so you see it in the terminal
        print(f"Login attempt with missing credentials from {request.remote_addr}")
        current_app.logger.warning("Login attempt with missing credentials from %s", request.remote_addr)
        return jsonify({"error": "Missing credentials"}), 400

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
    requires_two_factor = user.last_login_at is None

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
        return (
            jsonify(
                {
                    "requires_two_factor": True,
                    "challenge_id": challenge_id,
                    "email": masked_email,
                    "expires_in": CHALLENGE_TTL_SECONDS,
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
    user_dict = _finalize_successful_login(user)
    return jsonify(user_dict), 200


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

    full_name = id_info.get("name") or ""
    preferred_username = id_info.get("preferred_username") or ""
    google_sub = id_info.get("sub") or ""
    picture = id_info.get("picture")

    user = User.query.filter_by(email=email).first()
    if not user:
        base_username = preferred_username or email.split("@")[0] or f"user_{google_sub[:8]}"
        base_candidate = _sanitize_username(base_username)
        candidate = base_candidate
        suffix = 1
        while User.query.filter_by(username=candidate).first():
            candidate = f"{base_candidate}{suffix}"
            suffix += 1

        user = User(
            username=candidate,
            email=email,
            role=UserRole.STUDENT,
            full_name=full_name or None,
            avatar_url=picture or None,
            status=UserStatus.ACTIVE.value,
            invited_at=now_kuala_lumpur(),
        )
        user.set_password(secrets.token_urlsafe(24))
        current_app.logger.info("Created new user via Google Sign-In email=%s username=%s", email, candidate)
        db.session.add(user)
    else:
        updated = False
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            updated = True
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            updated = True
        if (user.status or "").lower() == UserStatus.PENDING.value:
            user.status = UserStatus.ACTIVE.value
            updated = True
        if updated:
            current_app.logger.info("Updated Google profile details for user id=%s", user.id)

    user.last_login_at = now_kuala_lumpur()
    db.session.commit()
    return jsonify(user.to_dict()), 200


@api_bp.route("/auth/verify-2fa", methods=["POST"])
def api_verify_two_factor():
    data = request.get_json() or {}
    challenge_id = (data.get("challenge_id") or "").strip()
    code = (data.get("code") or "").strip()

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

    print(f"Two-factor verification successful: user id={user.id} username={user.username} from {request.remote_addr}")
    current_app.logger.info(
        "Two-factor verification successful: user id=%s username=%s from %s",
        user.id,
        user.username,
        request.remote_addr,
    )
    user_dict = _finalize_successful_login(user)
    return jsonify(user_dict), 200


def _detect_extension_from_header(header: str) -> str:
    header = (header or "").lower()
    if "jpeg" in header or "jpg" in header:
        return "jpg"
    if "gif" in header:
        return "gif"
    if "webp" in header:
        return "webp"
    return "png"


@api_bp.route("/users/<int:user_id>/avatar", methods=["POST"])
def api_upload_avatar(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

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


@api_bp.route("/users/<int:user_id>/avatar", methods=["DELETE"])
def api_delete_avatar(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

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


@api_bp.route("/static/avatars/<path:filename>", methods=["GET"])
def api_get_avatar(filename):
    upload_root = current_app.config.get("UPLOAD_FOLDER")
    avatar_subdir = current_app.config.get("AVATAR_SUBDIR", "avatars")
    if not upload_root:
        return jsonify({"error": "Upload folder not configured"}), 500

    target_dir = os.path.join(upload_root, avatar_subdir)
    return send_from_directory(target_dir, filename)


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
