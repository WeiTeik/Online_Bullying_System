from flask import Blueprint, request, jsonify
from .crud import user as user_crud

user_bp = Blueprint('user', __name__, url_prefix='/users')

@user_bp.route('/', methods=['GET'])
def get_users():
    users = user_crud.get_all_users()
    return jsonify(users)

@user_bp.route('/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = user_crud.get_user_by_id(user_id)
    if user:
        return jsonify(user)
    return jsonify({'error': 'User not found'}), 404

@user_bp.route('/', methods=['POST'])
def create_user():
    data = request.get_json()
    new_user = user_crud.create_user(data)
    return jsonify(new_user), 201

@user_bp.route('/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.get_json()
    updated_user = user_crud.update_user(user_id, data)
    if updated_user:
        return jsonify(updated_user)
    return jsonify({'error': 'User not found'}), 404

@user_bp.route('/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    result = user_crud.delete_user(user_id)
    if result:
        return jsonify({'message': 'User deleted'})
    return jsonify({'error': 'User not found'}), 404