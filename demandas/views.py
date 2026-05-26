import csv
import io
from rest_framework import viewsets
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
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
            qs = qs.filter(data__year=ano)
        if mes:
            qs = qs.filter(data__month=mes)
        if dia:
            qs = qs.filter(data__day=dia)
        return qs


@api_view(['POST'])
@parser_classes([MultiPartParser])
def importar_demandas(request):
    arquivo = request.FILES.get('arquivo')
    if not arquivo:
        return Response({'erro': 'Nenhum arquivo enviado.'}, status=400)

    categorias_validas = {c for c, _ in Demanda.CATEGORIA_CHOICES}
    status_validos = {s for s, _ in Demanda.STATUS_CHOICES}

    importados = 0
    erros = []

    try:
        conteudo = arquivo.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(conteudo))
        for i, row in enumerate(reader, start=2):
            titulo = row.get('titulo', '').strip()
            categoria = row.get('categoria', '').strip().lower()
            status_val = row.get('status', 'aberta').strip().lower()

            if not titulo:
                erros.append(f"Linha {i}: campo 'titulo' vazio.")
                continue
            if categoria not in categorias_validas:
                erros.append(f"Linha {i}: categoria '{categoria}' inválida. Use: {', '.join(categorias_validas)}")
                continue
            if status_val not in status_validos:
                status_val = 'aberta'

            Demanda.objects.create(titulo=titulo, categoria=categoria, status=status_val)
            importados += 1
    except Exception as e:
        return Response({'erro': f'Erro ao processar arquivo: {str(e)}'}, status=400)

    return Response({'importados': importados, 'erros': erros})
