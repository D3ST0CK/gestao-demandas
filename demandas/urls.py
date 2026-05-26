from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import DemandaViewSet, SetorViewSet, PessoaViewSet, importar_demandas

router = DefaultRouter()
router.register(r'demandas', DemandaViewSet, basename='demanda')
router.register(r'setores', SetorViewSet, basename='setor')
router.register(r'pessoas', PessoaViewSet, basename='pessoa')

urlpatterns = [
    path('demandas/importar/', importar_demandas),
] + router.urls
