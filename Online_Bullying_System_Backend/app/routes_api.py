import base64
import binascii
import os
import time
from flask import Blueprint, jsonify, request, current_app, send_from_directory
from werkzeug.utils import secure_filename
from app.models import User, db
from app.crud.user import get_all_users, get_user_by_id, create_user, update_user, delete_user

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
