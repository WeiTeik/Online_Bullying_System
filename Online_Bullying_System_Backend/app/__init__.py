import os
from flask import Flask
from config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import logging

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # ensure logger prints INFO+ to the console
    logging.basicConfig(level=logging.INFO)
    app.logger.setLevel(logging.INFO)
    app.logger.info("App create_app() initializing")

    db.init_app(app)

    # Import models here so Flask-Migrate can detect them
    from app import models

    migrate.init_app(app, db)

    # enable CORS for frontend connections (adjust origins in Config if needed)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ensure upload directories exist
    upload_root = app.config.get("UPLOAD_FOLDER")
    avatar_subdir = app.config.get("AVATAR_SUBDIR", "avatars")
    complaint_subdir = app.config.get("COMPLAINT_ATTACHMENT_SUBDIR", "complaints")
    if upload_root:
        try:
            os.makedirs(os.path.join(upload_root, avatar_subdir), exist_ok=True)
            os.makedirs(os.path.join(upload_root, complaint_subdir), exist_ok=True)
        except OSError:
            app.logger.warning("Could not create upload directory at %s", upload_root)

    # Import and register routes
    # from .routes import bp
    # app.register_blueprint(bp)

    from .routes_user import user_bp
    app.register_blueprint(user_bp)

    # register new API blueprint for frontend
    from .routes_api import api_bp
    app.register_blueprint(api_bp, url_prefix="/api")

    return app
