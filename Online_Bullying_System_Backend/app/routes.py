from flask import Blueprint, jsonify

bp = Blueprint('main', __name__)

@bp.route('/', methods=['GET'])
def home():
    return jsonify({"message": "API is working!"}), 200

@bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

@bp.route('/example', methods=['GET'])
def example_endpoint():
    return jsonify({'message': 'This is an example endpoint.'}), 200