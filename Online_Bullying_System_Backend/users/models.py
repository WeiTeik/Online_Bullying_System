from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # Additional fields can be added here
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    is_student = models.BooleanField(default=True)

    def __str__(self):
        return self.username