from django.contrib import admin
from .models import User  # Adjust the import based on your user model

admin.site.register(User)  # Register the User model with the admin site