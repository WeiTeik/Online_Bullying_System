from django.urls import path, include

urlpatterns = [
    path('complaints/', include('complaints.urls')),
    path('users/', include('users.urls')),
]