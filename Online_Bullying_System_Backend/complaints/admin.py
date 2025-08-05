from django.contrib import admin
from .models import Complaint

class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'submitted_at')
    search_fields = ('user__username', 'status')
    list_filter = ('status',)

admin.site.register(Complaint, ComplaintAdmin)