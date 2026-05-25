from decimal import Decimal
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Sum
from .models import EntradaBancoHoras
from .serializers import EntradaBancoHorasSerializer
from demandas.models import Demanda
from demandas.serializers import DemandaSerializer


class EntradaBancoHorasViewSet(viewsets.ModelViewSet):
    serializer_class = EntradaBancoHorasSerializer
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        qs = EntradaBancoHoras.objects.all()
        ano = self.request.query_params.get('ano')
        mes = self.request.query_params.get('mes')
        dia = self.request.query_params.get('dia')
        if ano:
            qs = qs.filter(data__year=ano)
        if mes:
            qs = qs.filter(data__month=mes)
        if dia:
            qs = qs.filter(data__day=dia)
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        creditos = EntradaBancoHoras.objects.filter(tipo='credito').aggregate(total=Sum('horas'))['total'] or Decimal('0')
        debitos = EntradaBancoHoras.objects.filter(tipo='debito').aggregate(total=Sum('horas'))['total'] or Decimal('0')
        response.data = {
            'saldo': float(creditos - debitos),
            'entradas': response.data,
        }
        return response


@api_view(['GET'])
def dashboard(request):
    demandas = Demanda.objects.all()
    total = demandas.count()
    concluidas_count = demandas.filter(status='concluida').count()
    taxa = round((concluidas_count / total * 100), 1) if total > 0 else 0
    recentes = demandas[:5]

    por_categoria = {}
    for cat, _ in Demanda.CATEGORIA_CHOICES:
        por_categoria[cat] = demandas.filter(categoria=cat).count()

    creditos = EntradaBancoHoras.objects.filter(tipo='credito').aggregate(total=Sum('horas'))['total'] or Decimal('0')
    debitos = EntradaBancoHoras.objects.filter(tipo='debito').aggregate(total=Sum('horas'))['total'] or Decimal('0')

    return Response({
        'demandas_abertas': demandas.filter(status='aberta').count(),
        'em_andamento': demandas.filter(status='andamento').count(),
        'concluidas': concluidas_count,
        'total': total,
        'taxa_conclusao': taxa,
        'por_categoria': por_categoria,
        'saldo_banco_horas': float(creditos - debitos),
        'recentes': DemandaSerializer(recentes, many=True).data,
    })
