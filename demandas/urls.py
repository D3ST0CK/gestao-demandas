from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import DemandaViewSet, importar_demandas

router = DefaultRouter()
router.register(r'demandas', DemandaViewSet, basename='demanda')

urlpatterns = [
    path('demandas/importar/', importar_demandas),
] + router.urls
