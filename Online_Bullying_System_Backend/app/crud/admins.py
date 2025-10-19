import re
from typing import Dict, Tuple
from html import escape as html_escape

from flask import current_app
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models import (
    User,
    UserRole,
    UserStatus,
    db,
    now_kuala_lumpur,
)
from app.utils.email import send_email
from app.utils.passwords import generate_strong_password

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class AdminInviteError(ValueError):
    """Raised when administrator invitation cannot be completed due to validation errors."""


class AdminDataError(RuntimeError):
    """Raised when administrator invitation fails due to storage or infrastructure issues."""


def _normalise_email(email: str) -> str:
    value = (email or "").strip().lower()
    if not value or not _EMAIL_PATTERN.match(value):
        raise AdminInviteError("Please provide a valid administrator email address.")
    return value


def _normalise_name(name: str) -> str:
    value = (name or "").strip()
    if not value:
        raise AdminInviteError("Administrator name is required.")
    if len(value) > 120:
        raise AdminInviteError("Administrator name must be 120 characters or fewer.")
    return value


def _resolve_role(role) -> UserRole:
    if isinstance(role, UserRole):
        if role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return role
        raise AdminInviteError("Role must be ADMIN or SUPER_ADMIN for administrator invitations.")

    value = (role or "").strip().upper()
    if not value:
        return UserRole.ADMIN
    if value not in {"ADMIN", "SUPER_ADMIN"}:
        raise AdminInviteError("Role must be ADMIN or SUPER_ADMIN for administrator invitations.")
    return UserRole[value]


def _generate_unique_username(full_name: str, email: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "", (full_name or "").lower())
    if not base:
        base = re.sub(r"[^a-z0-9]+", "", (email or "").split("@", 1)[0].lower())
    if not base:
        base = "admin"
    base = base[:60]  # leave room for suffix

    candidate = base
    suffix = 1
    while User.query.filter(User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
        if len(candidate) > 80:
            candidate = f"{base[: 80 - len(str(suffix))]}{suffix}"
    return candidate


def invite_admin(full_name: str, email: str, role=None) -> Tuple[Dict, str]:
    """
    Create or refresh an administrator account, generating a temporary password
    and dispatching an invitation email. Returns the admin dict and the password.
    """
    name_value = _normalise_name(full_name)
    email_value = _normalise_email(email)
    role_value = _resolve_role(role)
    invited_at = now_kuala_lumpur()
    temporary_password = generate_strong_password(12)

    existing = User.query.filter(User.email == email_value).first()

    if existing:
        if existing.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            raise AdminInviteError("A user with this email already exists with a different role.")

        existing.full_name = name_value
        existing.role = role_value
        existing.invited_at = invited_at
        existing.status = UserStatus.PENDING.value
        existing.set_password(temporary_password)
        existing.last_login_at = None

        try:
            db.session.flush()
        except SQLAlchemyError as exc:
            db.session.rollback()
            raise AdminDataError(
                "Unable to update the administrator record. Please ensure database migrations are up to date."
            ) from exc

        try:
            _send_admin_credentials_email(
                name_value,
                email_value,
                temporary_password,
                role_value,
                is_reset=True,
            )
        except Exception as exc:  # pylint: disable=broad-except
            db.session.rollback()
            raise AdminInviteError("Failed to send administrator invitation email.") from exc

        db.session.commit()
        return existing.to_dict(), temporary_password

    username = _generate_unique_username(name_value, email_value)
    user = User(
        username=username,
        email=email_value,
        role=role_value,
        full_name=name_value,
        status=UserStatus.PENDING.value,
        invited_at=invited_at,
    )
    user.set_password(temporary_password)
    db.session.add(user)

    try:
        db.session.flush()
    except IntegrityError as exc:
        db.session.rollback()
        raise AdminInviteError("A user with this name or email already exists.") from exc
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise AdminDataError(
            "Administrator invitations require the latest database schema. Please run 'flask db upgrade' and try again."
        ) from exc

    try:
        _send_admin_credentials_email(
            name_value,
            email_value,
            temporary_password,
            role_value,
            is_reset=False,
        )
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        raise AdminInviteError("Failed to send administrator invitation email.") from exc

    db.session.commit()
    return user.to_dict(), temporary_password


def _send_admin_credentials_email(
    full_name: str,
    email: str,
    password: str,
    role: UserRole,
    *,
    is_reset: bool,
) -> None:
    login_url = current_app.config.get("PORTAL_LOGIN_URL")
    login_line = f"Login here: {login_url}" if login_url else ""
    role_label = "Super Administrator" if role == UserRole.SUPER_ADMIN else "Administrator"

    if is_reset:
        subject = "Your YouMatter Administrator Password Has Been Reset"
        intro = "Your administrator password has been reset by a super administrator."
        prompt = "Use the temporary password below to sign in and update your password immediately."
    else:
        subject = "YouMatter Administrator Invitation"
        intro = f"You have been invited to serve as a {role_label} on the YouMatter platform."
        prompt = "Use the credentials below to sign in:"

    text_lines = [
        f"Hi {full_name},",
        "",
        intro,
        prompt,
        f"Email: {email}",
        f"Temporary Password: {password}",
        "",
        "Please sign in as soon as possible and change your password after logging in.",
        login_line,
        "",
        "If you did not expect this invitation, please contact your super administrator immediately.",
        "",
        "Regards,",
        "YouMatter Support Team",
    ]

    text_body = "\n".join(line for line in text_lines if line)

    safe_full_name = html_escape(full_name)
    safe_email = html_escape(email)
    safe_password = html_escape(password)
    safe_login_url = html_escape(login_url) if login_url else None
    safe_role = html_escape(role_label)

    html_lines = [
        f"<p>Hi {safe_full_name},</p>",
        f"<p>{intro}</p>",
        "<p>Use the credentials below to sign in:</p>",
        "<ul>",
        f"  <li><strong>Email:</strong> {safe_email}</li>",
        f"  <li><strong>Temporary Password:</strong> {safe_password}</li>",
        f"  <li><strong>Role:</strong> {safe_role}</li>",
        "</ul>",
        "<p>Please sign in as soon as possible and change your password after logging in.</p>",
    ]
    if safe_login_url:
        html_lines.append(f'<p><a href="{safe_login_url}">Click here to sign in</a></p>')
    html_lines.extend(
        [
            "<p>If you did not expect this invitation, please contact your super administrator immediately.</p>",
            "<p>Regards,<br/>YouMatter Support Team</p>",
        ]
    )

    html_body = "\n".join(html_lines)
    send_email(subject, email, text_body, html_body=html_body)
