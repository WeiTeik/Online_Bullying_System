# Online Bullying System Backend

This project is a Django-based backend for an Online Bullying Complaint System. It provides a platform for users to submit complaints regarding bullying incidents and allows administrators to manage these complaints effectively.

## Project Structure

```
online-bullying-system-backend/
├── manage.py                # Command-line utility for interacting with the Django project
├── requirements.txt         # List of Python packages required for the project
├── online_bullying_system/   # Main Django application directory
│   ├── __init__.py
│   ├── settings.py          # Project settings and configuration
│   ├── urls.py              # URL patterns for the project
│   ├── wsgi.py              # WSGI configuration for deployment
│   └── asgi.py              # ASGI configuration for deployment
├── complaints/              # App for managing complaints
│   ├── __init__.py
│   ├── admin.py             # Admin site configuration for complaints
│   ├── apps.py              # App configuration for complaints
│   ├── models.py            # Data models for complaints
│   ├── views.py             # Views for handling complaints
│   ├── urls.py              # URL patterns for complaints app
│   ├── serializers.py       # Serializers for complaint data
│   └── migrations/          # Database migrations for complaints
│       └── __init__.py
├── users/                   # App for managing users
│   ├── __init__.py
│   ├── admin.py             # Admin site configuration for users
│   ├── apps.py              # App configuration for users
│   ├── models.py            # Data models for users
│   ├── views.py             # Views for handling user-related requests
│   ├── urls.py              # URL patterns for users app
│   ├── serializers.py       # Serializers for user data
│   └── migrations/          # Database migrations for users
│       └── __init__.py
├── static/                  # Static files (CSS, JS, images)
│   ├── css
│   ├── js
│   └── images
├── media/                   # Directory for uploaded media files
└── README.md                # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd online-bullying-system-backend
   ```

2. **Create a virtual environment:**
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the required packages:**
   ```
   pip install -r requirements.txt
   ```

4. **Apply migrations:**
   ```
   python manage.py migrate
   ```

5. **Run the development server:**
   ```
   python manage.py runserver
   ```

## Usage

- Access the API endpoints for complaints and users as defined in the `urls.py` files of the respective apps.
- Use the Django admin interface to manage complaints and users.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.