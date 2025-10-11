from __future__ import annotations

from datetime import datetime, date, time
from typing import Any, Dict, List, Optional

from app.models import (
    db,
    Complaint,
    ComplaintComment,
    ComplaintStatus,
    User,
    now_kuala_lumpur,
    KUALA_LUMPUR_TZ,
)
from werkzeug.utils import secure_filename

ALLOWED_ATTACHMENT_EXTENSIONS = {
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "txt",
    "rtf",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "heic",
    "heif",
}

IMAGE_ATTACHMENT_EXTENSIONS = {
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "heic",
    "heif",
}

ALLOWED_ATTACHMENT_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/rtf",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
    "image/heic",
    "image/heif",
}

PROHIBITED_ATTACHMENT_EXTENSIONS = {
    "exe",
    "msi",
    "bat",
    "cmd",
    "com",
    "scr",
    "sh",
    "bash",
    "zsh",
    "ksh",
    "csh",
    "ps1",
    "psm1",
    "jar",
    "js",
    "mjs",
    "ts",
    "cpl",
    "vbs",
    "hta",
    "dll",
    "so",
    "apk",
    "ipa",
    "pkg",
    "dmg",
    "app",
    "iso",
    "img",
}

PROHIBITED_ATTACHMENT_MIME_PREFIXES = (
    "application/x-ms",
    "application/x-dosexec",
    "application/x-executable",
    "application/java-archive",
    "text/javascript",
    "application/javascript",
    "application/x-sh",
    "application/x-bat",
    "application/vnd.android.package-archive",
    "application/x-ms-installer",
    "application/x-apple-diskimage",
)

ATTACHMENT_MAX_COUNT = 5
ATTACHMENT_MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ATTACHMENT_MAX_TOTAL_SIZE = 20 * 1024 * 1024  # 20 MB

ATTACHMENT_MIME_BY_EXTENSION = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "txt": "text/plain",
    "rtf": "application/rtf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "heic": "image/heic",
    "heif": "image/heif",
}


def _generate_reference_code() -> str:
    last = (
        db.session.query(Complaint.reference_code)
        .order_by(Complaint.id.desc())
        .limit(1)
        .scalar()
    )

    if not last:
        return "A0001"

    # Split into prefix letters and numeric portion
    prefix = "".join(ch for ch in last if ch.isalpha())
    digits = "".join(ch for ch in last if ch.isdigit())

    if not prefix or not digits:
        # Fallback if previous code doesn't match expected format
        prefix = "A"
        digits = "0000"

    number = int(digits)

    if number < 9999:
        number += 1
        return f"{prefix}{number:04d}"

    # number reached 9999, reset digits and advance prefix
    number = 1
    letters = list(prefix)

    idx = len(letters) - 1
    while idx >= 0:
        if letters[idx] != "Z":
            letters[idx] = chr(ord(letters[idx]) + 1)
            break
        letters[idx] = "A"
        idx -= 1
    else:
        # all letters were Z, prepend a new letter
        letters.insert(0, "A")

    new_prefix = "".join(letters)
    return f"{new_prefix}{number:04d}"


def _format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    size = float(value)
    idx = 0
    while size >= 1024 and idx < len(units) - 1:
        size /= 1024
        idx += 1
    if idx == 0:
        return f"{int(size)} {units[idx]}"
    return f"{size:.1f} {units[idx]}"


def _has_dangerous_double_extension(filename: str) -> bool:
    parts = filename.lower().split(".")
    if len(parts) <= 2:
        return False
    # Ignore leading empty part for filenames that start with a dot
    candidate_parts = [part for part in parts[:-1] if part]
    return any(part in PROHIBITED_ATTACHMENT_EXTENSIONS for part in candidate_parts)


def _validate_and_prepare_attachments(raw_attachments: Any) -> List[Dict[str, Any]]:
    if not raw_attachments:
        return []

    if not isinstance(raw_attachments, list):
        raise ValueError("Attachments must be provided as a list.")

    if len(raw_attachments) > ATTACHMENT_MAX_COUNT:
        raise ValueError(f"No more than {ATTACHMENT_MAX_COUNT} attachments are allowed per complaint.")

    cleaned: List[Dict[str, Any]] = []
    total_size = 0

    for raw in raw_attachments:
        if not isinstance(raw, dict):
            raise ValueError("Invalid attachment payload.")

        name = (raw.get("name") or "").strip()
        if not name:
            raise ValueError("Attachment name is required.")
        safe_name = secure_filename(name)
        if not safe_name:
            raise ValueError("Attachment name is invalid.")

        extension = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
        if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
            raise ValueError(f"Attachment '{name}' uses an unsupported file type.")
        if extension in PROHIBITED_ATTACHMENT_EXTENSIONS or _has_dangerous_double_extension(safe_name):
            raise ValueError(f"Attachment '{name}' is not permitted.")

        mime = (raw.get("type") or "").strip().lower()
        if mime:
            if mime.startswith(PROHIBITED_ATTACHMENT_MIME_PREFIXES):
                raise ValueError(f"Attachment '{name}' file type is not permitted.")
            if mime not in ALLOWED_ATTACHMENT_MIME_TYPES:
                if not (mime.startswith("image/") and extension in IMAGE_ATTACHMENT_EXTENSIONS):
                    raise ValueError(f"Attachment '{name}' uses an unsupported MIME type.")
        else:
            mime = ATTACHMENT_MIME_BY_EXTENSION.get(extension, "")

        try:
            size_value = int(raw.get("size", 0))
        except (TypeError, ValueError):
            size_value = 0

        if size_value <= 0:
            raise ValueError(f"Attachment '{name}' has an invalid size.")
        if size_value > ATTACHMENT_MAX_FILE_SIZE:
            raise ValueError(
                f"Attachment '{name}' exceeds the {_format_bytes(ATTACHMENT_MAX_FILE_SIZE)} per-file limit."
            )
        if total_size + size_value > ATTACHMENT_MAX_TOTAL_SIZE:
            raise ValueError(
                f"Total attachment size exceeds the {_format_bytes(ATTACHMENT_MAX_TOTAL_SIZE)} limit."
            )

        cleaned.append(
            {
                "name": safe_name,
                "size": size_value,
                "type": mime or ATTACHMENT_MIME_BY_EXTENSION.get(extension),
            }
        )
        total_size += size_value

    return cleaned


def _parse_incident_date(value: Optional[str]):
    if not value:
        return None

    if isinstance(value, datetime):
        if value.tzinfo:
            return value.astimezone(KUALA_LUMPUR_TZ)
        return value.replace(tzinfo=KUALA_LUMPUR_TZ)

    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=KUALA_LUMPUR_TZ)

    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None

    candidates = [
        raw,
        raw.replace("Z", "+00:00"),
    ]
    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo:
                return parsed.astimezone(KUALA_LUMPUR_TZ)
            return parsed.replace(tzinfo=KUALA_LUMPUR_TZ)
        except ValueError:
            continue

    fallback_formats = ["%Y-%m-%d %H:%M", "%Y-%m-%d"]
    for fmt in fallback_formats:
        try:
            naive = datetime.strptime(raw, fmt)
            return naive.replace(tzinfo=KUALA_LUMPUR_TZ)
        except ValueError:
            continue

    return None


def create_complaint(data: Dict[str, Any]) -> Complaint:
    anonymous = bool(data.get("anonymous"))
    user_id = data.get("user_id")

    user: Optional[User] = None
    if user_id:
        user = User.query.get(user_id)

    provided_name = (data.get("student_name") or "").strip()
    base_name = provided_name or (user.username if user else "Unknown Student")

    raw_attachments = data.get("attachments") or []
    attachments = _validate_and_prepare_attachments(raw_attachments)

    status_value = data.get("status", ComplaintStatus.NEW.value)
    if isinstance(status_value, str):
        try:
            status_enum = ComplaintStatus(status_value.lower())
        except ValueError:
            # backward compatibility for legacy "pending"
            if status_value.lower() == "pending":
                status_enum = ComplaintStatus.NEW
            else:
                status_enum = ComplaintStatus.NEW
    elif isinstance(status_value, ComplaintStatus):
        status_enum = status_value
    else:
        status_enum = ComplaintStatus.NEW

    now_kl = now_kuala_lumpur()
    complaint = Complaint(
        reference_code=_generate_reference_code(),
        user_id=user.id if user else None,
        student_name=base_name,
        anonymous=anonymous,
        incident_type=data.get("incident_type") or data.get("incidentType") or "unspecified",
        description=data.get("description") or "",
        room_number=data.get("room_number") or data.get("roomNumber"),
        incident_date=_parse_incident_date(data.get("incident_date") or data.get("incidentDate")),
        witnesses=data.get("witnesses"),
        attachments=attachments,
        status=status_enum.value if isinstance(status_enum, ComplaintStatus) else status_enum,
        submitted_at=now_kl,
        updated_at=now_kl,
    )
    db.session.add(complaint)
    db.session.commit()
    return complaint


def get_complaint_by_id(complaint_id: int, include_comments: bool = False) -> Optional[Dict[str, Any]]:
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return None
    return complaint.to_dict(include_comments=include_comments)


def get_complaints_for_user(user_id: int, include_comments: bool = False) -> List[Dict[str, Any]]:
    complaints = (
        Complaint.query.filter_by(user_id=user_id)
        .order_by(Complaint.submitted_at.desc())
        .all()
    )
    return [complaint.to_dict(include_comments=include_comments) for complaint in complaints]


def get_all_complaints(include_comments: bool = False) -> List[Dict[str, Any]]:
    complaints = Complaint.query.order_by(Complaint.submitted_at.desc()).all()
    return [complaint.to_dict(include_comments=include_comments) for complaint in complaints]


def add_comment(
    complaint_id: int,
    author_id: Optional[int],
    message: str,
) -> Optional[ComplaintComment]:
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return None

    user = User.query.get(author_id) if author_id else None
    author_name = user.username if user else "System"
    author_role = user.role.value if user else "SYSTEM"

    comment = ComplaintComment(
        complaint_id=complaint.id,
        author_id=user.id if user else None,
        author_name=author_name,
        author_role=author_role,
        message=message,
        created_at=now_kuala_lumpur(),
    )
    db.session.add(comment)
    db.session.commit()
    return comment


def get_comments(complaint_id: int) -> List[Dict[str, Any]]:
    comments = (
        ComplaintComment.query.filter_by(complaint_id=complaint_id)
        .order_by(ComplaintComment.created_at.asc())
        .all()
    )
    return [comment.to_dict() for comment in comments]


def update_complaint_status(complaint_id: int, status_value: str) -> Optional[Complaint]:
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        return None

    try:
        status_enum = ComplaintStatus(status_value.lower())
    except ValueError:
        if status_value.lower() == "pending":
            status_enum = ComplaintStatus.NEW
        else:
            raise

    complaint.status = status_enum.value
    complaint.updated_at = now_kuala_lumpur()
    db.session.commit()
    return complaint
