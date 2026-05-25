from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('demandas.urls')),
    path('api/', include('banco_horas.urls')),
]
