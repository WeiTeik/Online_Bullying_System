from app import db
import enum
from datetime import datetime, date
from zoneinfo import ZoneInfo
from werkzeug.security import generate_password_hash, check_password_hash

KUALA_LUMPUR_TZ = ZoneInfo("Asia/Kuala_Lumpur")


def now_kuala_lumpur() -> datetime:
    return datetime.now(KUALA_LUMPUR_TZ)

class UserRole(enum.Enum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    password_hash = db.Column(db.String(512), nullable=False)
    avatar_url = db.Column(db.String(512), nullable=True)
    complaints = db.relationship(
        "Complaint",
        backref="user",
        lazy="dynamic",
        cascade="all, delete-orphan"
    )
    comments = db.relationship(
        "ComplaintComment",
        backref="author",
        lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role.value,
            "avatar_url": self.avatar_url,
            # do not include password_hash
        }
        return data


class ComplaintStatus(enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class Complaint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reference_code = db.Column(db.String(32), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    student_name = db.Column(db.String(120), nullable=False)
    anonymous = db.Column(db.Boolean, nullable=False, default=False)
    incident_type = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    room_number = db.Column(db.String(64), nullable=True)
    incident_date = db.Column(db.DateTime(timezone=True), nullable=True)
    witnesses = db.Column(db.Text, nullable=True)
    attachments = db.Column(db.JSON, nullable=True)
    status = db.Column(
        db.Enum(
            ComplaintStatus,
            values_callable=lambda enum: [member.value for member in enum],
            native_enum=False,
            validate_strings=True,
        ),
        nullable=False,
        default=ComplaintStatus.NEW.value,
    )
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now_kuala_lumpur)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=now_kuala_lumpur, onupdate=now_kuala_lumpur
    )
    comments = db.relationship(
        "ComplaintComment",
        backref="complaint",
        cascade="all, delete-orphan",
        lazy="dynamic",
        order_by="ComplaintComment.created_at"
    )

    def student_display_name(self) -> str:
        if self.anonymous:
            return "Anonymously"
        return self.student_name

    def to_dict(self, include_comments: bool = False):
        status_value = self.status.value if isinstance(self.status, ComplaintStatus) else self.status
        if isinstance(status_value, str) and status_value.lower() == "pending":
            status_value = ComplaintStatus.NEW.value

        data = {
            "id": self.id,
            "reference_code": self.reference_code,
            "student_name": self.student_display_name(),
            "student_real_name": self.student_name,
            "anonymous": self.anonymous,
            "incident_type": self.incident_type,
            "description": self.description,
            "room_number": self.room_number,
            "incident_date": self.incident_date.isoformat() if self.incident_date else None,
            "witnesses": self.witnesses,
            "attachments": self.attachments or [],
            "status": status_value,
            "submitted_at": self.submitted_at.isoformat() if isinstance(self.submitted_at, (datetime, date)) else self.submitted_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, (datetime, date)) else self.updated_at,
            "user_id": self.user_id,
        }
        if include_comments:
            data["comments"] = [
                comment.to_dict() for comment in self.comments.order_by(ComplaintComment.created_at.asc())
            ]
        return data


class ComplaintComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaint.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    author_name = db.Column(db.String(120), nullable=False)
    author_role = db.Column(db.String(32), nullable=True)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now_kuala_lumpur)

    def to_dict(self):
        return {
            "id": self.id,
            "complaint_id": self.complaint_id,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "author_role": self.author_role,
            "message": self.message,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, (datetime, date)) else self.created_at,
        }
