import { useEffect, useState } from 'react'
import api from '../api'
import FormModal from './FormModal'

const CATEGORIA_COLOR = {
  suporte: 'bg-amber-500/20 text-amber-400',
  tecnico: 'bg-violet-500/20 text-violet-400',
  rotina: 'bg-emerald-500/20 text-emerald-400',
}
const STATUS_COLOR = {
  aberta: 'bg-blue-500/20 text-blue-400',
  andamento: 'bg-amber-500/20 text-amber-400',
  concluida: 'bg-emerald-500/20 text-emerald-400',
}
const CATEGORIA_LABEL = { suporte: 'Suporte', tecnico: 'Técnico', rotina: 'Rotina' }
const STATUS_LABEL = { aberta: 'Aberta', andamento: 'Em andamento', concluida: 'Concluída' }

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = { titulo: '', categoria: 'suporte', status: 'aberta', data: hoje(), responsavel: '' }

function inputClass() {
  return 'bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500'
}

export default function DemandasPage() {
  const [demandas, setDemandas] = useState([])
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [filtroAno, setFiltroAno] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroDia, setFiltroDia] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)
  const [setores, setSetores] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [setorSelecionado, setSetorSelecionado] = useState('')
  const [textoIA, setTextoIA] = useState('')
  const [previewIA, setPreviewIA] = useState(null)
  const [loadingIA, setLoadingIA] = useState(false)
  const [erroIA, setErroIA] = useState('')

  useEffect(() => {
    api.get('/setores/').then(r => setSetores(r.data))
  }, [])

  useEffect(() => {
    if (setorSelecionado) {
      api.get('/pessoas/', { params: { setor: setorSelecionado } }).then(r => setPessoas(r.data))
    } else {
      setPessoas([])
    }
  }, [setorSelecionado])

  function carregar() {
    const params = {}
    if (filtroAno) params.ano = filtroAno
    if (filtroMes) params.mes = filtroMes
    if (filtroDia) params.dia = filtroDia
    api.get('/demandas/', { params }).then(r => setDemandas(r.data))
  }

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

  useEffect(() => { carregar() }, [filtroAno, filtroMes, filtroDia])

  const filtradas = demandas.filter(d =>
    (!filtroCategoria || d.categoria === filtroCategoria) &&
    (!filtroStatus || d.status === filtroStatus)
  )

  function abrirNova() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setSetorSelecionado('')
    setModal(true)
  }

  function abrirEditar(d) {
    setForm({ titulo: d.titulo, categoria: d.categoria, status: d.status, data: d.data || hoje(), responsavel: d.responsavel || '' })
    setEditId(d.id)
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (editId) {
      await api.patch(`/demandas/${editId}/`, form)
    } else {
      await api.post('/demandas/', form)
    }
    setModal(false)
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir esta demanda?')) return
    await api.delete(`/demandas/${id}/`)
    carregar()
  }

  async function analisarTexto() {
    if (!textoIA.trim()) return
    setLoadingIA(true)
    setErroIA('')
    setPreviewIA(null)
    try {
      const r = await api.post('/demandas/ia/', { texto: textoIA })
      setPreviewIA(r.data)
    } catch (e) {
      setErroIA(e.response?.data?.error || 'Erro ao analisar o texto.')
    } finally {
      setLoadingIA(false)
    }
  }

  async function confirmarIA() {
    const { responsavel_nome, ...payload } = previewIA
    await api.post('/demandas/', payload)
    setPreviewIA(null)
    setTextoIA('')
    carregar()
  }

  async function alterarStatus(d, novoStatus) {
    await api.patch(`/demandas/${d.id}/`, {
      status: novoStatus,
      ...(novoStatus === 'concluida' ? { concluida_em: new Date().toISOString() } : {}),
    })
    carregar()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          Demandas
        </h2>
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
      </div>

      <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
        <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Criar com IA</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={textoIA}
            onChange={e => setTextoIA(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loadingIA && analisarTexto()}
            placeholder="Ex: Relatório de vendas pro financeiro, responsável João, entrega sexta"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {(textoIA || previewIA || erroIA) && (
            <button
              onClick={() => { setTextoIA(''); setPreviewIA(null); setErroIA('') }}
              className="text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
            >
              Descartar
            </button>
          )}
          <button
            onClick={analisarTexto}
            disabled={loadingIA || !textoIA.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {loadingIA ? 'Analisando…' : 'Analisar'}
          </button>
        </div>

        {erroIA && <p className="text-red-400 text-xs mt-2">{erroIA}</p>}

        {previewIA && (
          <div className="mt-3 bg-slate-700 rounded-lg p-3 flex items-start justify-between gap-4">
            <div className="text-sm space-y-0.5">
              <p className="text-slate-200 font-medium">{previewIA.titulo}</p>
              <p className="text-slate-400 text-xs capitalize">
                {previewIA.categoria} · {previewIA.data} · {previewIA.responsavel_nome || 'Sem responsável'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setPreviewIA(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
              >
                Corrigir
              </button>
              <button
                onClick={confirmarIA}
                className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>

      {resultadoImport && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${resultadoImport.erro ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
          {resultadoImport.erro
            ? resultadoImport.erro
            : `✓ ${resultadoImport.importados} demandas importadas.${resultadoImport.erros?.length ? ` ${resultadoImport.erros.length} linha(s) ignorada(s).` : ''}`
          }
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
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

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-slate-500 text-center">Nenhuma demanda encontrada.</td></tr>
            )}
            {filtradas.map(d => (
              <tr key={d.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-200">{d.titulo}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[d.categoria]}`}>
                    {CATEGORIA_LABEL[d.categoria]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select value={d.status}
                    onChange={e => alterarStatus(d, e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer ${STATUS_COLOR[d.status]} bg-transparent`}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm">
                  {d.responsavel_nome || '—'}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {d.data ? new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => abrirEditar(d)}
                      className="text-slate-400 hover:text-slate-200 text-xs transition-colors">Editar</button>
                    <button onClick={() => excluir(d.id)}
                      className="text-red-400 hover:text-red-300 text-xs transition-colors">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <FormModal titulo={editId ? 'Editar Demanda' : 'Nova Demanda'} onClose={() => setModal(false)} onSubmit={salvar}>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Título</label>
            <input required value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
              className={inputClass()} placeholder="Descreva a demanda" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Categoria</label>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
              className={inputClass()}>
              {Object.entries(CATEGORIA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className={inputClass()}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Data</label>
            <input type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
              className={inputClass()} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Setor do Responsável</label>
            <select value={setorSelecionado} onChange={e => { setSetorSelecionado(e.target.value); setForm(f => ({ ...f, responsavel: '' })) }}
              className={inputClass()}>
              <option value="">Sem responsável</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          {setorSelecionado && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Responsável</label>
              <select value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                className={inputClass()}>
                <option value="">Selecione</option>
                {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
        </FormModal>
      )}
    </div>
  )
}
