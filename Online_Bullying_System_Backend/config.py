import os
from dotenv import load_dotenv

load_dotenv()  # take environment variables from .env.

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv('SQLALCHEMY_DATABASE_URI')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = os.getenv('DEBUG', 'False') == 'True'
    API_KEY = os.getenv('API_KEY')
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
    AVATAR_SUBDIR = os.getenv('AVATAR_SUBDIR', 'avatars')
    COMPLAINT_ATTACHMENT_SUBDIR = os.getenv('COMPLAINT_ATTACHMENT_SUBDIR', 'complaints')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 32 * 1024 * 1024))  # allow up to ~32 MB
    MAIL_ENABLED = os.getenv('MAIL_ENABLED', 'True').lower() == 'true'
    MAIL_SERVER = os.getenv('MAIL_SERVER')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 465))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'False').lower() == 'true'
    MAIL_USE_SSL = os.getenv('MAIL_USE_SSL', 'True').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', MAIL_USERNAME)
    MAIL_TIMEOUT = int(os.getenv('MAIL_TIMEOUT', 30))
    PORTAL_LOGIN_URL = os.getenv('PORTAL_LOGIN_URL')
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    SESSION_TTL_SECONDS = int(os.getenv('SESSION_TTL_SECONDS', 60 * 60 * 12))  # default 12 hours
    SESSION_MAX_IDLE_SECONDS = int(os.getenv('SESSION_MAX_IDLE_SECONDS', 60 * 60 * 2))  # 2 hours idle timeout
    SESSION_ROTATE_SECONDS = int(os.getenv('SESSION_ROTATE_SECONDS', 60 * 60 * 6))  # reissue token every 6h
    SESSION_TOKEN_BYTES = int(os.getenv('SESSION_TOKEN_BYTES', 48))
    TWO_FACTOR_CODE_LENGTH = int(os.getenv('TWO_FACTOR_CODE_LENGTH', 6))
    TWO_FACTOR_TTL_SECONDS = int(os.getenv('TWO_FACTOR_TTL_SECONDS', 10 * 60))
    TWO_FACTOR_MAX_ATTEMPTS = int(os.getenv('TWO_FACTOR_MAX_ATTEMPTS', 5))
