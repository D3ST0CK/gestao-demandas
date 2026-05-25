from rest_framework.routers import DefaultRouter
from .views import DemandaViewSet

router = DefaultRouter()
router.register(r'demandas', DemandaViewSet, basename='demanda')

urlpatterns = router.urls
