import csv
import io
import json
from datetime import date
from groq import Groq
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from .models import Demanda, Setor, Pessoa
from .serializers import DemandaSerializer, SetorSerializer, PessoaSerializer


class SetorViewSet(viewsets.ModelViewSet):
    queryset = Setor.objects.prefetch_related('pessoas')
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
        qs = Demanda.objects.select_related('responsavel')
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

        client = Groq(api_key=settings.GROQ_API_KEY)

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

        resposta = client.chat.completions.create(
            model='llama-3.1-8b-instant',
            messages=[{'role': 'user', 'content': user_msg}],
            max_tokens=300,
        )

        try:
            texto_resposta = resposta.choices[0].message.content.strip()
            if texto_resposta.startswith('```'):
                texto_resposta = texto_resposta.split('```')[1]
                if texto_resposta.startswith('json'):
                    texto_resposta = texto_resposta[4:]
            resultado = json.loads(texto_resposta)
            resultado['status'] = STATUS_MAP.get(str(resultado.get('status', '')).lower().strip(), 'aberta')
            resultado['categoria'] = CATEGORIA_MAP.get(str(resultado.get('categoria', '')).lower().strip(), 'suporte')
            return Response(resultado)
        except json.JSONDecodeError:
            return Response(
                {'error': 'Não foi possível interpretar o texto. Tente ser mais específico.'},
                status=422
            )

    @action(detail=False, methods=['get'])
    def briefing(self, request):
        from decimal import Decimal
        from banco_horas.models import EntradaBancoHoras
        from django.db.models import Sum

        hoje = date.today()

        abertas = Demanda.objects.filter(status='aberta')
        em_andamento = Demanda.objects.filter(status='andamento')
        vencidas = Demanda.objects.filter(data__lt=hoje).exclude(status='concluida')

        creditos = EntradaBancoHoras.objects.filter(tipo='credito').aggregate(total=Sum('horas'))['total'] or Decimal('0')
        debitos = EntradaBancoHoras.objects.filter(tipo='debito').aggregate(total=Sum('horas'))['total'] or Decimal('0')
        saldo = float(creditos - debitos)
        saldo_h = int(abs(saldo))
        saldo_min = round((abs(saldo) - saldo_h) * 60)
        saldo_str = f"{'+'  if saldo >= 0 else '-'}{saldo_h}h{f'{saldo_min}min' if saldo_min else ''}"

        vencidas_titulos = list(vencidas.values_list('titulo', flat=True)[:3])

        prompt = f"""Você é um assistente de produtividade. Gere um briefing curto (2-3 frases) em português sobre o dia de trabalho com base nos dados abaixo. Seja direto e objetivo.

Dados:
- Demandas abertas: {abertas.count()}
- Demandas em andamento: {em_andamento.count()}
- Demandas vencidas (data passada, não concluídas): {vencidas.count()}{f" — títulos: {', '.join(repr(t) for t in vencidas_titulos)}" if vencidas_titulos else ''}
- Saldo banco de horas: {saldo_str}
- Data de hoje: {hoje.strftime('%d/%m/%Y')}

Retorne apenas o texto do briefing, sem markdown."""

        client = Groq(api_key=settings.GROQ_API_KEY)
        resposta = client.chat.completions.create(
            model='llama-3.1-8b-instant',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=200,
        )
        return Response({
            'texto': resposta.choices[0].message.content.strip(),
            'gerado_em': hoje.isoformat(),
        })


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
