# Filtros, Dashboard, Import CSV e Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtros de data, card de taxa de conclusão no dashboard, import CSV em ambas as páginas, e fazer deploy no Vercel (frontend) + Railway (backend com PostgreSQL).

**Architecture:** Backend Django ganha filtros via query params e endpoints de importação CSV; frontend React consome esses novos parâmetros e adiciona file pickers; para deploy, SQLite é trocado por PostgreSQL via `dj-database-url`, frontend aponta para URL do Railway via variável de ambiente `VITE_API_URL`.

**Tech Stack:** Django REST Framework, dj-database-url, PostgreSQL (Railway), React + Vite, Vercel CLI, whitenoise

---

## File Map

| Arquivo | Ação | O que muda |
|---|---|---|
| `demandas/views.py` | Modificar | filtro por ano/mês/dia + endpoint `/importar/` |
| `banco_horas/views.py` | Modificar | filtro por ano/mês/dia no list + endpoint `/importar/` + `concluidas` no dashboard |
| `frontend/src/api.js` | Modificar | baseURL usa `import.meta.env.VITE_API_URL` |
| `frontend/src/components/DashboardPage.jsx` | Modificar | 4º card: concluídas + taxa |
| `frontend/src/components/DemandasPage.jsx` | Modificar | dropdowns Ano/Mês/Dia + botão Importar CSV |
| `frontend/src/components/BancoHorasPage.jsx` | Modificar | dropdowns Ano/Mês/Dia + botão Importar CSV |
| `projeto/settings.py` | Modificar | dj-database-url + whitenoise + ALLOWED_HOSTS |
| `requirements.txt` | Criar | todas as dependências Python |
| `Procfile` | Criar | comando de start para Railway |
| `runtime.txt` | Criar | versão do Python para Railway |
| `frontend/.env.example` | Criar | template da variável VITE_API_URL |
| `frontend/vercel.json` | Criar | rewrites para SPA routing |

---

## Task 1: Filtros de data no backend — Demandas

**Files:**
- Modify: `demandas/views.py`

- [ ] **Step 1: Atualizar `DemandaViewSet.get_queryset` para aceitar query params**

Em `demandas/views.py`, substitua a classe inteira:

```python
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
```

- [ ] **Step 2: Testar filtro manualmente**

Com Django rodando (`python3 manage.py runserver`):
```bash
# Cria demanda de teste se não houver
curl -s http://localhost:8000/api/demandas/ | python3 -c "import json,sys; print(json.load(sys.stdin))"

# Filtra pelo ano atual
curl -s "http://localhost:8000/api/demandas/?ano=2026" | python3 -c "import json,sys; d=json.load(sys.stdin); print('count:', len(d))"
```

Esperado: lista com demandas criadas em 2026.

- [ ] **Step 3: Commit**

```bash
cd /Users/victorwisley9gmail.com/projeto
git add demandas/views.py
git commit -m "feat: add date filters (year/month/day) to demandas endpoint"
```

---

## Task 2: Filtros de data no backend — Banco de Horas

**Files:**
- Modify: `banco_horas/views.py`

- [ ] **Step 1: Atualizar `EntradaBancoHorasViewSet` para filtrar por data e adicionar `concluidas` no dashboard**

Substitua `banco_horas/views.py` inteiro:

```python
from decimal import Decimal
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Sum, Count
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
        # saldo é sempre sobre TODOS os registros, não só os filtrados
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
```

- [ ] **Step 2: Testar endpoint dashboard atualizado**

```bash
curl -s http://localhost:8000/api/dashboard/ | python3 -m json.tool
```

Esperado: JSON com campos `concluidas`, `total`, `taxa_conclusao`.

- [ ] **Step 3: Commit**

```bash
git add banco_horas/views.py
git commit -m "feat: add date filters to banco-horas and taxa_conclusao to dashboard"
```

---

## Task 3: Endpoint de importação CSV — Demandas

**Files:**
- Modify: `demandas/views.py`
- Modify: `demandas/urls.py`

- [ ] **Step 1: Adicionar view de importação em `demandas/views.py`**

Adicione os imports no **topo** do arquivo (após os imports existentes):

```python
import csv
import io
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
```

Depois adicione a função no **final** do arquivo:

```python
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
```

- [ ] **Step 2: Registrar rota em `demandas/urls.py`**

Substitua `demandas/urls.py`:

```python
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import DemandaViewSet, importar_demandas

router = DefaultRouter()
router.register(r'demandas', DemandaViewSet, basename='demanda')

urlpatterns = router.urls + [
    path('demandas/importar/', importar_demandas),
]
```

- [ ] **Step 3: Testar importação com arquivo CSV**

Crie `/tmp/demandas_teste.csv`:
```
titulo,categoria,status
Problema no servidor,suporte,aberta
Ajuste no pipeline,tecnico,andamento
Reunião de alinhamento,rotina,aberta
Linha inválida,,
```

```bash
curl -s -X POST http://localhost:8000/api/demandas/importar/ \
  -F "arquivo=@/tmp/demandas_teste.csv" | python3 -m json.tool
```

Esperado: `{"importados": 3, "erros": ["Linha 5: campo 'titulo' vazio." ou similar]}`

- [ ] **Step 4: Commit**

```bash
git add demandas/views.py demandas/urls.py
git commit -m "feat: add CSV import endpoint for demandas"
```

---

## Task 4: Endpoint de importação CSV — Banco de Horas

**Files:**
- Modify: `banco_horas/views.py`
- Modify: `banco_horas/urls.py`

- [ ] **Step 1: Adicionar imports no **topo** de `banco_horas/views.py` (após os existentes)**

```python
import csv
import io
from rest_framework.parsers import MultiPartParser
```

Depois adicione a função no **final** do arquivo:

```python
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
```

- [ ] **Step 2: Atualizar `banco_horas/urls.py`**

Substitua `banco_horas/urls.py`:

```python
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import EntradaBancoHorasViewSet, dashboard, importar_banco_horas

router = DefaultRouter()
router.register(r'banco-horas', EntradaBancoHorasViewSet, basename='bancohoras')

urlpatterns = router.urls + [
    path('dashboard/', dashboard),
    path('banco-horas/importar/', importar_banco_horas),
]
```

- [ ] **Step 3: Testar importação**

Crie `/tmp/banco_teste.csv`:
```
data,horas,tipo,descricao
2025-05-10,4.0,credito,Sábado 10/05
2025-05-17,4.5,credito,Sábado 17/05
2025-05-20,2.0,debito,Saí mais cedo
linha_ruim,abc,invalido,
```

```bash
curl -s -X POST http://localhost:8000/api/banco-horas/importar/ \
  -F "arquivo=@/tmp/banco_teste.csv" | python3 -m json.tool
```

Esperado: `{"importados": 3, "erros": [...]}`

- [ ] **Step 4: Commit**

```bash
git add banco_horas/views.py banco_horas/urls.py
git commit -m "feat: add CSV import endpoint for banco-horas"
```

---

## Task 5: Frontend — Dashboard com 4º card (taxa de conclusão)

**Files:**
- Modify: `frontend/src/components/DashboardPage.jsx`

- [ ] **Step 1: Substituir grid de 3 cards por 4 e adicionar card de concluídas**

No `DashboardPage.jsx`, substitua o bloco dos cards (a `div` com `grid grid-cols-3`):

```jsx
<div className="grid grid-cols-4 gap-4 mb-8">
  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
    <p className="text-3xl font-bold text-emerald-400">{data.demandas_abertas}</p>
    <p className="text-sm text-slate-400 mt-1">Demandas abertas</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
    <p className="text-3xl font-bold text-amber-400">{data.em_andamento}</p>
    <p className="text-sm text-slate-400 mt-1">Em andamento</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
    <p className="text-3xl font-bold text-violet-400">{data.concluidas}</p>
    <p className="text-sm text-slate-400 mt-1">
      Concluídas
      {data.total > 0 && (
        <span className="ml-2 text-xs text-slate-500">
          {data.taxa_conclusao}% de {data.total}
        </span>
      )}
    </p>
  </div>
  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
    <p className="text-3xl font-bold"><SaldoHoras saldo={data.saldo_banco_horas} /></p>
    <p className="text-sm text-slate-400 mt-1">Saldo banco de horas</p>
  </div>
</div>
```

- [ ] **Step 2: Verificar no browser**

Com React rodando (`npm run dev`), abrir `http://localhost:5173/` e confirmar que há 4 cards na linha superior, com o card violeta mostrando concluídas e percentual.

- [ ] **Step 3: Commit**

```bash
cd /Users/victorwisley9gmail.com/projeto
git add frontend/src/components/DashboardPage.jsx
git commit -m "feat: add conclusao rate card to dashboard"
```

---

## Task 6: Frontend — Filtros Ano/Mês/Dia em DemandasPage

**Files:**
- Modify: `frontend/src/components/DemandasPage.jsx`

- [ ] **Step 1: Adicionar estados e dropdowns de data**

No `DemandasPage.jsx`, adicione 3 novos estados após os existentes (`filtroCategoria`, `filtroStatus`):

```jsx
const [filtroAno, setFiltroAno] = useState('')
const [filtroMes, setFiltroMes] = useState('')
const [filtroDia, setFiltroDia] = useState('')
```

- [ ] **Step 2: Atualizar função `carregar` para passar query params**

Substitua a função `carregar`:

```jsx
function carregar() {
  const params = {}
  if (filtroAno) params.ano = filtroAno
  if (filtroMes) params.mes = filtroMes
  if (filtroDia) params.dia = filtroDia
  api.get('/demandas/', { params }).then(r => setDemandas(r.data))
}
```

- [ ] **Step 3: Atualizar `useEffect` para re-carregar quando filtros de data mudam**

Substitua o `useEffect` existente:

```jsx
useEffect(() => { carregar() }, [filtroAno, filtroMes, filtroDia])
```

- [ ] **Step 4: Adicionar dropdowns de data na seção de filtros**

Na linha dos filtros (após os selects existentes de categoria e status), adicione:

```jsx
<select value={filtroAno} onChange={e => setFiltroAno(e.target.value)}
  className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
  <option value="">Todos os anos</option>
  {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
</select>
<select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
  className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
  <option value="">Todos os meses</option>
  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    .map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
</select>
<select value={filtroDia} onChange={e => setFiltroDia(e.target.value)}
  className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
  <option value="">Todos os dias</option>
  {Array.from({length: 31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
</select>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DemandasPage.jsx
git commit -m "feat: add year/month/day filters to DemandasPage"
```

---

## Task 7: Frontend — Import CSV em DemandasPage

**Files:**
- Modify: `frontend/src/components/DemandasPage.jsx`

- [ ] **Step 1: Adicionar estado e handler de importação**

Logo após os estados existentes no `DemandasPage`, adicione:

```jsx
const [importando, setImportando] = useState(false)
const [resultadoImport, setResultadoImport] = useState(null)

async function importarCSV(e) {
  const arquivo = e.target.files[0]
  if (!arquivo) return
  setImportando(true)
  setResultadoImport(null)
  const form = new FormData()
  form.append('arquivo', arquivo)
  try {
    const r = await api.post('/demandas/importar/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setResultadoImport(r.data)
    carregar()
  } catch {
    setResultadoImport({ erro: 'Falha ao importar. Verifique o formato do arquivo.' })
  } finally {
    setImportando(false)
    e.target.value = ''
  }
}
```

- [ ] **Step 2: Adicionar botão de importação ao lado do botão "Nova Demanda"**

Substitua a linha do botão `+ Nova Demanda` no header da página:

```jsx
<div className="flex gap-2 items-center">
  <label className={`cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${importando ? 'opacity-50' : ''}`}>
    {importando ? 'Importando...' : '⬆ Importar CSV'}
    <input type="file" accept=".csv" className="hidden" onChange={importarCSV} disabled={importando} />
  </label>
  <button onClick={abrirNova}
    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
    + Nova Demanda
  </button>
</div>
```

- [ ] **Step 3: Mostrar resultado do import (logo abaixo do header)**

Após o `<div className="flex justify-between...">` do header, adicione:

```jsx
{resultadoImport && (
  <div className={`mb-4 p-3 rounded-lg text-sm border ${resultadoImport.erro ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
    {resultadoImport.erro
      ? resultadoImport.erro
      : `✓ ${resultadoImport.importados} demandas importadas.${resultadoImport.erros?.length ? ` ${resultadoImport.erros.length} linha(s) ignorada(s).` : ''}`
    }
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DemandasPage.jsx
git commit -m "feat: add CSV import to DemandasPage"
```

---

## Task 8: Frontend — Filtros Ano/Mês/Dia + Import CSV em BancoHorasPage

**Files:**
- Modify: `frontend/src/components/BancoHorasPage.jsx`

- [ ] **Step 1: Adicionar estados de filtro e importação**

Logo após `const [modal, setModal] = useState(false)`, adicione:

```jsx
const [filtroAno, setFiltroAno] = useState('')
const [filtroMes, setFiltroMes] = useState('')
const [filtroDia, setFiltroDia] = useState('')
const [importando, setImportando] = useState(false)
const [resultadoImport, setResultadoImport] = useState(null)
```

- [ ] **Step 2: Atualizar `carregar` para passar filtros e `useEffect`**

```jsx
function carregar() {
  const params = {}
  if (filtroAno) params.ano = filtroAno
  if (filtroMes) params.mes = filtroMes
  if (filtroDia) params.dia = filtroDia
  api.get('/banco-horas/', { params }).then(r => setData(r.data))
}

useEffect(() => { carregar() }, [filtroAno, filtroMes, filtroDia])
```

- [ ] **Step 3: Adicionar handler de importação**

```jsx
async function importarCSV(e) {
  const arquivo = e.target.files[0]
  if (!arquivo) return
  setImportando(true)
  setResultadoImport(null)
  const form = new FormData()
  form.append('arquivo', arquivo)
  try {
    const r = await api.post('/banco-horas/importar/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setResultadoImport(r.data)
    carregar()
  } catch {
    setResultadoImport({ erro: 'Falha ao importar. Verifique o formato do arquivo.' })
  } finally {
    setImportando(false)
    e.target.value = ''
  }
}
```

- [ ] **Step 4: Substituir header da página (botão + Registrar) por versão com import**

```jsx
<div className="flex justify-between items-center mb-6">
  <h2 className="text-xl font-semibold text-slate-100">Banco de Horas</h2>
  <div className="flex gap-2 items-center">
    <label className={`cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${importando ? 'opacity-50' : ''}`}>
      {importando ? 'Importando...' : '⬆ Importar CSV'}
      <input type="file" accept=".csv" className="hidden" onChange={importarCSV} disabled={importando} />
    </label>
    <button onClick={() => setModal(true)}
      className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
      + Registrar
    </button>
  </div>
</div>
```

- [ ] **Step 5: Adicionar feedback de import e dropdowns de data após o header**

Logo após o header (antes do card de saldo):

```jsx
{resultadoImport && (
  <div className={`mb-4 p-3 rounded-lg text-sm border ${resultadoImport.erro ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
    {resultadoImport.erro
      ? resultadoImport.erro
      : `✓ ${resultadoImport.importados} entradas importadas.${resultadoImport.erros?.length ? ` ${resultadoImport.erros.length} linha(s) ignorada(s).` : ''}`
    }
  </div>
)}

<div className="flex gap-3 mb-4">
  <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)}
    className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
    <option value="">Todos os anos</option>
    {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
  </select>
  <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
    className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
    <option value="">Todos os meses</option>
    {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
      .map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
  </select>
  <select value={filtroDia} onChange={e => setFiltroDia(e.target.value)}
    className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
    <option value="">Todos os dias</option>
    {Array.from({length: 31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
  </select>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/BancoHorasPage.jsx
git commit -m "feat: add date filters and CSV import to BancoHorasPage"
```

---

## Task 9: Frontend — api.js usa variável de ambiente

**Files:**
- Modify: `frontend/src/api.js`
- Create: `frontend/.env.example`
- Create: `frontend/.env.local`

- [ ] **Step 1: Atualizar `api.js`**

Substitua `frontend/src/api.js`:

```js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

export default api
```

- [ ] **Step 2: Criar `frontend/.env.example`**

```
VITE_API_URL=https://SEU-PROJETO.railway.app/api
```

- [ ] **Step 3: Criar `frontend/.env.local` (desenvolvimento local)**

```
VITE_API_URL=http://localhost:8000/api
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api.js frontend/.env.example
git commit -m "feat: use VITE_API_URL env var for API base URL"
```

---

## Task 10: Preparar `vercel.json` para SPA routing

**Files:**
- Create: `frontend/vercel.json`

- [ ] **Step 1: Criar `frontend/vercel.json`**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Isso garante que rotas como `/demandas` e `/banco-horas` funcionem diretamente (sem 404 em refresh).

- [ ] **Step 2: Commit**

```bash
git add frontend/vercel.json
git commit -m "feat: add vercel.json for SPA routing"
```

---

## Task 11: Preparar backend para Railway (PostgreSQL + whitenoise)

**Files:**
- Modify: `projeto/settings.py`
- Create: `requirements.txt`
- Create: `Procfile`
- Create: `runtime.txt`

- [ ] **Step 1: Instalar dependências**

```bash
cd /Users/victorwisley9gmail.com/projeto
pip3 install dj-database-url whitenoise psycopg2-binary gunicorn
```

- [ ] **Step 2: Atualizar `projeto/settings.py`**

Adicione ao final do arquivo (mantendo tudo que já existe):

```python
import os
import dj_database_url

# Lê DATABASE_URL do ambiente (Railway injeta automaticamente)
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    DATABASES['default'] = dj_database_url.config(default=DATABASE_URL, conn_max_age=600)

# Whitenoise para servir arquivos estáticos
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Hosts dinâmicos: aceita qualquer subdomínio Railway + localhost
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '.railway.app', '.up.railway.app']

# CORS para produção: Railway aceita o domínio Vercel via variável de ambiente
CORS_ALLOWED_ORIGINS_EXTRA = os.environ.get('CORS_ALLOWED_ORIGINS_EXTRA', '').split(',')
CORS_ALLOWED_ORIGINS = ['http://localhost:5173'] + [o for o in CORS_ALLOWED_ORIGINS_EXTRA if o]
```

- [ ] **Step 3: Criar `Procfile`** (na raiz `/projeto/`)

```
web: gunicorn projeto.wsgi --log-file -
```

- [ ] **Step 4: Criar `runtime.txt`**

```
python-3.12
```

- [ ] **Step 5: Criar `requirements.txt`** (na raiz `/projeto/`)

```bash
pip3 freeze > requirements.txt
```

Confirme que contém `Django`, `djangorestframework`, `django-cors-headers`, `dj-database-url`, `whitenoise`, `gunicorn`, `psycopg2-binary`.

- [ ] **Step 6: Commit**

```bash
git add projeto/settings.py requirements.txt Procfile runtime.txt
git commit -m "feat: prepare backend for Railway deployment (PostgreSQL + gunicorn + whitenoise)"
```

---

## Task 12: Deploy do Backend no Railway

- [ ] **Step 1: Criar conta e projeto no Railway**

Acesse [railway.app](https://railway.app), faça login com GitHub.

- [ ] **Step 2: Criar banco PostgreSQL no Railway**

No painel Railway: **New Project → Add a Service → Database → PostgreSQL**. Após criar, copie a variável `DATABASE_URL` na aba **Variables**.

- [ ] **Step 3: Criar serviço para o Django**

No mesmo projeto: **Add a Service → GitHub Repo** → selecione o repositório. Configure:
- **Root Directory:** `/projeto` (ou deixe vazio se o repositório tem o `manage.py` na raiz)
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn projeto.wsgi --log-file -`

- [ ] **Step 4: Adicionar variáveis de ambiente no Railway**

Na aba **Variables** do serviço Django, adicione:
```
SECRET_KEY=<gere uma nova com: python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DEBUG=False
DATABASE_URL=<cole o valor do PostgreSQL>
CORS_ALLOWED_ORIGINS_EXTRA=https://SEU-PROJETO.vercel.app
```

- [ ] **Step 5: Executar migrations no Railway**

No painel Railway, vá em **Deployments → Open Shell** (ou use Railway CLI):
```bash
python manage.py migrate
```

- [ ] **Step 6: Confirmar que a API responde**

Copie a URL pública do serviço (ex: `https://projeto-production.up.railway.app`) e teste:
```bash
curl https://SEU-PROJETO.up.railway.app/api/dashboard/
```

Esperado: JSON com dados do dashboard.

---

## Task 13: Deploy do Frontend no Vercel

- [ ] **Step 1: Instalar Vercel CLI**

```bash
npm install -g vercel
```

- [ ] **Step 2: Fazer login**

```bash
vercel login
```

- [ ] **Step 3: Deploy do frontend**

```bash
cd /Users/victorwisley9gmail.com/projeto/frontend
vercel
```

Quando perguntar:
- **Set up and deploy?** → Y
- **Which scope?** → sua conta
- **Link to existing project?** → N
- **Project name?** → `gestao-demandas`
- **Directory?** → `./` (já está em `/frontend`)
- **Override build settings?** → N

- [ ] **Step 4: Adicionar variável de ambiente no Vercel**

```bash
vercel env add VITE_API_URL production
```

Cole o valor: `https://SEU-PROJETO.up.railway.app/api`

- [ ] **Step 5: Re-deploy com a variável**

```bash
vercel --prod
```

- [ ] **Step 6: Confirmar funcionamento**

Abra a URL do Vercel no browser. Verifique que:
- Dashboard carrega dados do Railway
- Sem erros de CORS no console do browser

---

## Verificação Final

```bash
# Backend local ainda funciona
cd /Users/victorwisley9gmail.com/projeto && python3 manage.py runserver

# Testar filtro de data
curl "http://localhost:8000/api/demandas/?ano=2026&mes=5" | python3 -m json.tool

# Testar import CSV demandas
curl -X POST http://localhost:8000/api/demandas/importar/ -F "arquivo=@/tmp/demandas_teste.csv" | python3 -m json.tool

# Testar import CSV banco de horas
curl -X POST http://localhost:8000/api/banco-horas/importar/ -F "arquivo=@/tmp/banco_teste.csv" | python3 -m json.tool

# Frontend: abrir e verificar 4 cards, filtros e botões de import
# http://localhost:5173

# Produção: verificar URL Vercel no browser
```
