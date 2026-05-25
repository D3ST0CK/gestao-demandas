from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import EntradaBancoHorasViewSet, dashboard

router = DefaultRouter()
router.register(r'banco-horas', EntradaBancoHorasViewSet, basename='entradabancohoras')

urlpatterns = router.urls + [
    path('dashboard/', dashboard),
]
