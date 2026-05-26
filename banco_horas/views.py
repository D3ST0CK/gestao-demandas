import csv
import io
from datetime import datetime, date, timedelta
from decimal import Decimal
from django.db.models import Count
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
    hoje = date.today()

    data_inicio_str = request.query_params.get('data_inicio')
    data_fim_str = request.query_params.get('data_fim')

    try:
        data_inicio = date.fromisoformat(data_inicio_str) if data_inicio_str else None
        data_fim = date.fromisoformat(data_fim_str) if data_fim_str else None
    except ValueError:
        data_inicio = data_fim = None

    demandas = Demanda.objects.all()
    if data_inicio:
        demandas = demandas.filter(data__gte=data_inicio)
    if data_fim:
        demandas = demandas.filter(data__lte=data_fim)

    total = demandas.count()
    concluidas_count = demandas.filter(status='concluida').count()
    taxa = round((concluidas_count / total * 100), 1) if total > 0 else 0
    recentes = demandas[:5]

    por_categoria = {}
    for cat, _ in Demanda.CATEGORIA_CHOICES:
        por_categoria[cat] = demandas.filter(categoria=cat).count()

    creditos = EntradaBancoHoras.objects.filter(tipo='credito').aggregate(total=Sum('horas'))['total'] or Decimal('0')
    debitos = EntradaBancoHoras.objects.filter(tipo='debito').aggregate(total=Sum('horas'))['total'] or Decimal('0')

    # Demandas por dia — range filtrado ou últimos 30 dias
    inicio_grafico = data_inicio if data_inicio else (hoje - timedelta(days=29))
    fim_grafico = data_fim if data_fim else hoje
    num_dias = (fim_grafico - inicio_grafico).days + 1

    por_dia_qs = {
        str(e['data']): e['total']
        for e in Demanda.objects.filter(data__gte=inicio_grafico, data__lte=fim_grafico)
            .values('data').annotate(total=Count('id'))
    }
    por_dia = [
        {
            'data': str(inicio_grafico + timedelta(days=i)),
            'label': (inicio_grafico + timedelta(days=i)).strftime('%d/%m'),
            'total': por_dia_qs.get(str(inicio_grafico + timedelta(days=i)), 0),
        }
        for i in range(num_dias)
    ]

    # Demandas por semana — últimas 8 semanas (sempre fixo)
    por_semana = []
    for i in range(7, -1, -1):
        fim = hoje - timedelta(weeks=i)
        ini = fim - timedelta(days=6)
        por_semana.append({
            'label': ini.strftime('%d/%m'),
            'total': Demanda.objects.filter(data__gte=ini, data__lte=fim).count(),
        })

    return Response({
        'demandas_abertas': demandas.filter(status='aberta').count(),
        'em_andamento': demandas.filter(status='andamento').count(),
        'concluidas': concluidas_count,
        'total': total,
        'taxa_conclusao': taxa,
        'por_categoria': por_categoria,
        'saldo_banco_horas': float(creditos - debitos),
        'recentes': DemandaSerializer(recentes, many=True).data,
        'por_dia': por_dia,
        'por_semana': por_semana,
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

            try:
                datetime.strptime(data_val, '%Y-%m-%d')
            except ValueError:
                erros.append(f"Linha {i}: data '{data_val}' inválida. Use o formato YYYY-MM-DD.")
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
