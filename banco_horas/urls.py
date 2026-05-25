from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import EntradaBancoHorasViewSet, dashboard, importar_banco_horas

router = DefaultRouter()
router.register(r'banco-horas', EntradaBancoHorasViewSet, basename='entradabancohoras')

urlpatterns = [
    path('banco-horas/importar/', importar_banco_horas),
    path('dashboard/', dashboard),
] + router.urls
