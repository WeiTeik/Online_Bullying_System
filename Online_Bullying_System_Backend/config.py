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
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16 MB default
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
