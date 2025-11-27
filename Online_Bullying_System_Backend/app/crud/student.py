import re
from typing import Dict, List, Tuple
from html import escape as html_escape

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models import (
    User,
    UserRole,
    UserStatus,
    Complaint,
    ComplaintComment,
    LoginSession,
    TwoFactorChallengeModel,
    db,
    now_kuala_lumpur,
)
from app.utils.email import send_email
from app.utils.passwords import generate_strong_password
from flask import current_app

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class StudentInviteError(ValueError):
    """Domain-specific error to expose validation issues to callers."""


class StudentDataError(RuntimeError):
    """Raised when student listing or invitation fails due to data/storage issues."""


class StudentNotFoundError(LookupError):
    """Raised when the requested student cannot be located."""


def list_students() -> List[Dict]:
    try:
        students = (
            User.query.filter(User.role == UserRole.STUDENT)
            .order_by(User.status.asc(), User.full_name.asc(), User.email.asc())
            .all()
        )
        return [student.to_dict() for student in students]
    except SQLAlchemyError as exc:
        raise StudentDataError(
            "Unable to load student records. Please ensure database migrations are up to date (run 'flask db upgrade')."
        ) from exc


def _normalise_email(email: str) -> str:
    value = (email or "").strip().lower()
    if not value or not _EMAIL_PATTERN.match(value):
        raise StudentInviteError("Please provide a valid student email address.")
    return value


def _normalise_name(name: str) -> str:
    value = (name or "").strip()
    if not value:
        raise StudentInviteError("Student name is required.")
    if len(value) > 120:
        raise StudentInviteError("Student name must be 120 characters or fewer.")
    return value


def _generate_unique_username(full_name: str, email: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "", full_name.lower())
    if not base:
        base = re.sub(r"[^a-z0-9]+", "", email.split("@", 1)[0].lower())
    if not base:
        base = "student"
    base = base[:60]  # leave room for numeric suffix

    candidate = base
    suffix = 1
    while User.query.filter(User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
        if len(candidate) > 80:
            candidate = f"{base[: 80 - len(str(suffix))]}{suffix}"
    return candidate


def invite_student(full_name: str, email: str) -> Tuple[Dict, str]:
    name_value = _normalise_name(full_name)
    email_value = _normalise_email(email)

    existing = User.query.filter(User.email == email_value).first()
    invited_at = now_kuala_lumpur()
    temporary_password = generate_strong_password(12)

    if existing:
        if existing.role != UserRole.STUDENT:
            raise StudentInviteError("A user with this email already exists with a different role.")
        if (existing.status or "").lower() != UserStatus.PENDING.value:
            raise StudentInviteError("This student has already registered. Please reset their password instead.")

        existing.full_name = name_value
        existing.invited_at = invited_at
        existing.status = UserStatus.PENDING.value
        existing.set_password(temporary_password)
        existing.last_login_at = None

        try:
            db.session.flush()
        except SQLAlchemyError as exc:
            db.session.rollback()
            raise StudentDataError(
                "Unable to update the existing student record. Please ensure database migrations are up to date."
            ) from exc
        try:
            _send_credentials_email(name_value, email_value, temporary_password, is_reset=False)
        except Exception as exc:  # pylint: disable=broad-except
            db.session.rollback()
            raise StudentInviteError("Failed to send invitation email.") from exc
        db.session.commit()
        return existing.to_dict(), temporary_password

    username = _generate_unique_username(name_value, email_value)
    user = User(
        username=username,
        email=email_value,
        role=UserRole.STUDENT,
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
        raise StudentInviteError("A user with this name or email already exists.") from exc
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise StudentDataError(
            "Student invitations require the latest database schema. Please run 'flask db upgrade' and try again."
        ) from exc

    try:
        _send_credentials_email(name_value, email_value, temporary_password, is_reset=False)
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        raise StudentInviteError("Failed to send invitation email.") from exc

    db.session.commit()
    return user.to_dict(), temporary_password


def _send_credentials_email(full_name: str, email: str, password: str, *, is_reset: bool = False) -> None:
    login_url = current_app.config.get("PORTAL_LOGIN_URL")
    login_line = f"Login here: {login_url}" if login_url else ""

    if is_reset:
        subject = "Your YouMatter Portal Password Has Been Reset"
        intro = "Your password has been reset by an administrator."
        prompt = "Use the temporary password below to sign in and set a new password immediately."
    else:
        subject = "Welcome to the YouMatter Portal"
        intro = "You have been invited to join the YouMatter portal."
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
        "If you did not expect this invitation, please contact your administrator immediately.",
        "",
        "Regards,",
        "YouMatter Support Team",
    ]
    text_body = "\n".join(line for line in text_lines if line)

    safe_full_name = html_escape(full_name)
    safe_email = html_escape(email)
    safe_password = html_escape(password)
    safe_login_url = html_escape(login_url) if login_url else None

    html_lines = [
        f"<p>Hi {safe_full_name},</p>",
        f"<p>{intro}</p>",
        "<p>Use the credentials below to sign in:</p>",
        "<ul>",
        f"  <li><strong>Email:</strong> {safe_email}</li>",
        f"  <li><strong>Temporary Password:</strong> {safe_password}</li>",
        "</ul>",
        "<p>Please sign in as soon as possible and change your password after logging in.</p>",
    ]
    if safe_login_url:
        html_lines.append(f'<p><a href="{safe_login_url}">Click here to sign in</a></p>')
    html_lines.extend(
        [
            "<p>If you did not expect this invitation, please contact your administrator immediately.</p>",
            "<p>Regards,<br/>YouMatter Support Team</p>",
        ]
    )
    html_body = "\n".join(html_lines)
    send_email(subject, email, text_body, html_body=html_body)


def _get_student(student_id: int) -> User:
    student = User.query.get(student_id)
    if not student or student.role != UserRole.STUDENT:
        raise StudentNotFoundError("Student not found.")
    return student


def update_student(student_id: int, full_name: str, email: str) -> Dict:
    student = _get_student(student_id)
    name_value = _normalise_name(full_name or student.full_name or student.username or "")
    email_value = _normalise_email(email or student.email)

    conflict = User.query.filter(User.email == email_value, User.id != student.id).first()
    if conflict:
        raise StudentInviteError("Another user already uses that email address.")

    student.full_name = name_value
    student.email = email_value

    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise StudentInviteError("Unable to update student with the provided details.") from exc
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise StudentDataError("Failed to save the student changes. Please try again.") from exc

    return student.to_dict()


def reset_student_password(student_id: int) -> Tuple[Dict, str]:
    student = _get_student(student_id)
    temporary_password = generate_strong_password(12)
    student.set_password(temporary_password)
    student.invited_at = now_kuala_lumpur()
    student.last_login_at = None

    try:
        db.session.flush()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise StudentDataError("Unable to update the student record with the new password.") from exc

    try:
        _send_credentials_email(student.full_name or student.username, student.email, temporary_password, is_reset=True)
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        raise StudentInviteError("Failed to send the reset password email.") from exc

    db.session.commit()
    return student.to_dict(), temporary_password


def remove_student(student_id: int) -> None:
    student = _get_student(student_id)
    try:
        # clean up linked records that do not cascade on delete
        LoginSession.query.filter_by(user_id=student.id).delete(synchronize_session=False)
        TwoFactorChallengeModel.query.filter_by(user_id=student.id).delete(synchronize_session=False)
        ComplaintComment.query.filter_by(author_id=student.id).update(
            {"author_id": None}, synchronize_session=False
        )
        Complaint.query.filter_by(user_id=student.id).update({"user_id": None}, synchronize_session=False)
        db.session.delete(student)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise StudentDataError("Unable to remove the student at this time.") from exc
