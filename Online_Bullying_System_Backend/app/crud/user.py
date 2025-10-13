from app.models import db, User, UserRole, UserStatus, now_kuala_lumpur
from sqlalchemy.exc import IntegrityError

_VALID_USER_STATUSES = {status.value for status in UserStatus}


def _resolve_role(value):
    if isinstance(value, UserRole):
        return value
    if not value:
        return UserRole.STUDENT
    role_str = str(value).strip()
    if not role_str:
        return UserRole.STUDENT
    # allow both enum names and values irrespective of case
    normalized = role_str.upper()
    try:
        return UserRole[normalized]
    except KeyError:
        pass
    try:
        return UserRole(role_str.upper())
    except ValueError:
        try:
            return UserRole(role_str.lower())
        except ValueError as exc:
            raise ValueError("Invalid role") from exc


def _normalise_status(value):
    if value is None:
        return UserStatus.ACTIVE.value
    status = str(value).strip().lower()
    if status not in _VALID_USER_STATUSES:
        raise ValueError("Invalid status")
    return status

def get_all_users():
    users = User.query.all()
    return [user.to_dict() for user in users]

def get_user_by_id(user_id):
    user = User.query.get(user_id)
    return user.to_dict() if user else None

def create_user(data):
    try:
        role = _resolve_role(data.get('role'))
        status_value = _normalise_status(data.get('status'))
        full_name = (data.get('full_name') or '').strip() or data.get('username')
        user = User(
            username=data.get('username'),
            email=data.get('email'),
            role=role,
            avatar_url=data.get('avatar_url'),
            full_name=full_name,
            status=status_value,
        )
        if status_value == UserStatus.PENDING.value:
            user.invited_at = now_kuala_lumpur()
        password = data.get('password')
        if not password:
            return {"error": "Password is required"}, 400
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user.to_dict()
    except (ValueError, KeyError):
        return {"error": "Invalid input"}, 400
    except IntegrityError:
        db.session.rollback()
        return {"error": "Username or email already exists"}, 400

def update_user(user_id, data):
    user = User.query.get(user_id)
    if not user:
        return None
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)
    if 'full_name' in data:
        new_name = (data.get('full_name') or '').strip()
        user.full_name = new_name or None
    if 'role' in data:
        try:
            user.role = _resolve_role(data['role'])
        except ValueError:
            return {"error": "Invalid role"}, 400
    if 'status' in data:
        try:
            status_value = _normalise_status(data['status'])
        except ValueError:
            return {"error": "Invalid status"}, 400
        user.status = status_value
        if status_value == UserStatus.PENDING.value and not user.invited_at:
            user.invited_at = now_kuala_lumpur()
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    if 'avatar_url' in data:
        user.avatar_url = data['avatar_url']
    db.session.commit()
    return user.to_dict()

def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return False
    db.session.delete(user)
    db.session.commit()
    return True
