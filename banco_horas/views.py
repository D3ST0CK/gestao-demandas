import csv
import io
from decimal import Decimal
from rest_framework import viewsets
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
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


@api_view(['POST'])
@parser_classes([MultiPartParser])
def importar_banco_horas(request):
    arquivo = request.FILES.get('arquivo')
    if not arquivo:
        return Response({'erro': 'Nenhum arquivo enviado.'}, status=400)

    tipos_validos = {'credito', 'debito'}
    importados = 0
    erros = []

    try:
        conteudo = arquivo.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(conteudo))
        for i, row in enumerate(reader, start=2):
            data_val = row.get('data', '').strip()
            horas_val = row.get('horas', '').strip()
            tipo_val = row.get('tipo', '').strip().lower()
            descricao = row.get('descricao', '').strip()

            if not data_val:
                erros.append(f"Linha {i}: campo 'data' vazio.")
                continue
            if not horas_val:
                erros.append(f"Linha {i}: campo 'horas' vazio.")
                continue
            if tipo_val not in tipos_validos:
                erros.append(f"Linha {i}: tipo '{tipo_val}' inválido. Use: credito ou debito.")
                continue

            try:
                horas_float = float(horas_val)
            except ValueError:
                erros.append(f"Linha {i}: horas '{horas_val}' não é um número válido.")
                continue

            EntradaBancoHoras.objects.create(
                data=data_val,
                horas=horas_float,
                tipo=tipo_val,
                descricao=descricao,
            )
            importados += 1
    except Exception as e:
        return Response({'erro': f'Erro ao processar arquivo: {str(e)}'}, status=400)

    return Response({'importados': importados, 'erros': erros})
