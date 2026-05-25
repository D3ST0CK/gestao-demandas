from rest_framework import viewsets
from .models import Demanda
from .serializers import DemandaSerializer


class DemandaViewSet(viewsets.ModelViewSet):
    serializer_class = DemandaSerializer
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        qs = Demanda.objects.all()
        ano = self.request.query_params.get('ano')
        mes = self.request.query_params.get('mes')
        dia = self.request.query_params.get('dia')
        if ano:
            qs = qs.filter(criada_em__year=ano)
        if mes:
            qs = qs.filter(criada_em__month=mes)
        if dia:
            qs = qs.filter(criada_em__day=dia)
        return qs
