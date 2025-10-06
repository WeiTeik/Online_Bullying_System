from app.models import db, User, UserRole
from sqlalchemy.exc import IntegrityError

def get_all_users():
    users = User.query.all()
    return [user.to_dict() for user in users]

def get_user_by_id(user_id):
    user = User.query.get(user_id)
    return user.to_dict() if user else None

def create_user(data):
    try:
        role_str = data.get('role', 'student')
        role = UserRole(role_str)
        user = User(
            username=data.get('username'),
            email=data.get('email'),
            role=role,
            avatar_url=data.get('avatar_url')
        )
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
    if 'role' in data:
        try:
            user.role = UserRole(data['role'].lower())
        except ValueError:
            return {"error": "Invalid role"}, 400
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
