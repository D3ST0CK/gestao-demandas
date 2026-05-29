from django.contrib import admin
from django.db import connection
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response({'detail': 'Logout realizado.'})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health_view(request):
    """Endpoint leve e sem auth para keep-alive (UptimeRobot/cron-job.org).
    Toca o banco com um SELECT 1 para manter web e DB acordados."""
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
    return Response({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_view),
    path('api/auth/login/', obtain_auth_token),
    path('api/auth/logout/', logout_view),
    path('api/', include('demandas.urls')),
    path('api/', include('banco_horas.urls')),
]
