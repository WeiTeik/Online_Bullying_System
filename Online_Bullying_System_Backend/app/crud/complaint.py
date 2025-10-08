from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models import (
    db,
    Complaint,
    ComplaintComment,
    ComplaintStatus,
    User,
    now_kuala_lumpur,
)


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


def _parse_incident_date(value: Optional[str]):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def create_complaint(data: Dict[str, Any]) -> Complaint:
    anonymous = bool(data.get("anonymous"))
    user_id = data.get("user_id")

    user: Optional[User] = None
    if user_id:
        user = User.query.get(user_id)

    provided_name = (data.get("student_name") or "").strip()
    base_name = provided_name or (user.username if user else "Unknown Student")

    attachments = data.get("attachments") or []
    if isinstance(attachments, list):
        # Ensure attachments is a list of simple serialisable dicts
        normalised: List[Dict[str, Any]] = []
        for item in attachments:
            if isinstance(item, dict):
                normalised.append(
                    {
                        "name": item.get("name"),
                        "size": item.get("size"),
                        "type": item.get("type"),
                    }
                )
            else:
                normalised.append({"name": str(item)})
        attachments = normalised
    else:
        attachments = []

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
