import base64
import binascii
import os
import time
from flask import Blueprint, jsonify, request, current_app, send_from_directory
from werkzeug.utils import secure_filename
from app.models import User, UserStatus, db, now_kuala_lumpur
from app.crud.user import get_all_users, get_user_by_id, create_user, update_user, delete_user
from app.crud.complaint import (
    create_complaint,
    get_complaints_for_user,
    get_all_complaints,
    add_comment,
    get_complaint_by_id,
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

api_bp = Blueprint("api", __name__)

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


@api_bp.route("/complaints/<int:complaint_id>", methods=["GET"])
def api_get_complaint(complaint_id):
    complaint = get_complaint_by_id(complaint_id, include_comments=True)
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

    # success
    print(f"Login successful: user id={user.id} username={user.username} from {request.remote_addr}")
    current_app.logger.info("Login successful: user id=%s username=%s from %s", user.id, user.username, request.remote_addr)
    updated = False
    if (user.status or "").lower() == UserStatus.PENDING.value:
        user.status = UserStatus.ACTIVE.value
        updated = True
    user.last_login_at = now_kuala_lumpur()
    updated = True
    if updated:
        db.session.commit()
    return jsonify(user.to_dict()), 200


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
