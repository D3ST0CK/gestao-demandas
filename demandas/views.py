import csv
import io
import json
from datetime import date
from anthropic import Anthropic
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from .models import Demanda, Setor, Pessoa
from .serializers import DemandaSerializer, SetorSerializer, PessoaSerializer


class SetorViewSet(viewsets.ModelViewSet):
    queryset = Setor.objects.all()
    serializer_class = SetorSerializer
    http_method_names = ['get', 'post', 'patch', 'delete']


class PessoaViewSet(viewsets.ModelViewSet):
    serializer_class = PessoaSerializer
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        qs = Pessoa.objects.all()
        setor_id = self.request.query_params.get('setor')
        if setor_id:
            qs = qs.filter(setor_id=setor_id)
        return qs


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

    @action(detail=False, methods=['post'])
    def ia(self, request):
        texto = request.data.get('texto', '').strip()
        if not texto:
            return Response({'error': 'Texto obrigatório'}, status=400)

        pessoas = list(Pessoa.objects.values('id', 'nome'))

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        user_msg = f"""Extraia as informações do texto abaixo e retorne um JSON com estes campos:
- titulo: string descritiva da tarefa
- categoria: "suporte", "tecnico" ou "rotina" (escolha a mais adequada)
- status: "aberta"
- data: data no formato YYYY-MM-DD (hoje = {date.today().isoformat()} se não mencionado)
- responsavel: id numérico da pessoa (ou null se não mencionado)
- responsavel_nome: nome da pessoa (ou null)

Pessoas disponíveis: {json.dumps(pessoas, ensure_ascii=False)}

Retorne APENAS o JSON, sem markdown ou explicações.

Texto: {texto}"""

        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": user_msg}]
        )

        try:
            resultado = json.loads(msg.content[0].text)
            return Response(resultado)
        except json.JSONDecodeError:
            return Response(
                {'error': 'Não foi possível interpretar o texto. Tente ser mais específico.'},
                status=422
            )


CATEGORIA_MAP = {
    'suporte': 'suporte', 'support': 'suporte',
    'tecnico': 'tecnico', 'técnico': 'tecnico', 'technical': 'tecnico',
    'rotina': 'rotina', 'routine': 'rotina',
}
STATUS_MAP = {
    'aberta': 'aberta', 'aberto': 'aberta', 'open': 'aberta',
    'andamento': 'andamento', 'em andamento': 'andamento', 'in progress': 'andamento',
    'concluida': 'concluida', 'concluída': 'concluida', 'concluido': 'concluida',
    'concluído': 'concluida', 'done': 'concluida', 'finalizada': 'concluida',
}


def _get_field(row, *keys):
    for k in keys:
        val = row.get(k, row.get(k.capitalize(), row.get(k.upper(), ''))).strip()
        if val:
            return val
    return ''


@api_view(['POST'])
@parser_classes([MultiPartParser])
def importar_demandas(request):
    from datetime import datetime
    arquivo = request.FILES.get('arquivo')
    if not arquivo:
        return Response({'erro': 'Nenhum arquivo enviado.'}, status=400)

    importados = 0
    erros = []

    try:
        conteudo = arquivo.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(conteudo))
        # normaliza cabeçalhos para minúsculo sem espaços extras
        rows = [{k.strip().lower(): v for k, v in row.items()} for row in reader]
        for i, row in enumerate(rows, start=2):
            titulo = row.get('título', row.get('titulo', '')).strip()
            categoria_raw = row.get('categoria', '').strip().lower()
            status_raw = row.get('status', '').strip().lower()
            responsavel_nome = row.get('responsável', row.get('responsavel', '')).strip()
            data_raw = row.get('data', '').strip()

            if not titulo:
                erros.append(f"Linha {i}: campo 'titulo' vazio.")
                continue

            categoria = CATEGORIA_MAP.get(categoria_raw)
            if not categoria:
                erros.append(f"Linha {i}: categoria '{categoria_raw}' inválida. Use: suporte, tecnico ou rotina.")
                continue

            status_val = STATUS_MAP.get(status_raw, 'aberta')

            # parse de data: aceita dd/mm/yyyy ou yyyy-mm-dd
            data_val = None
            for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
                try:
                    data_val = datetime.strptime(data_raw, fmt).date()
                    break
                except ValueError:
                    continue

            # responsável por nome
            responsavel = None
            if responsavel_nome:
                responsavel = Pessoa.objects.filter(nome__iexact=responsavel_nome).first()

            kwargs = dict(titulo=titulo, categoria=categoria, status=status_val)
            if data_val:
                kwargs['data'] = data_val
            if responsavel:
                kwargs['responsavel'] = responsavel

            Demanda.objects.create(**kwargs)
            importados += 1
    except Exception as e:
        return Response({'erro': f'Erro ao processar arquivo: {str(e)}'}, status=400)

    return Response({'importados': importados, 'erros': erros})
