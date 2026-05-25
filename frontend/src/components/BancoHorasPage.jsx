import { useEffect, useState } from 'react'
import api from '../api'
import FormModal from './FormModal'

const EMPTY_FORM = { data: '', horas: '', tipo: 'credito', descricao: '' }

function inputClass() {
  return 'bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500'
}

function SaldoBadge({ saldo }) {
  const negativo = saldo < 0
  const abs = Math.abs(saldo)
  const h = Math.floor(abs)
  const min = Math.round((abs - h) * 60)
  return (
    <span className={`text-4xl font-bold ${negativo ? 'text-red-400' : 'text-blue-400'}`}>
      {negativo ? '-' : '+'}{h}h{min > 0 ? ` ${min}min` : ''}
    </span>
  )
}

export default function BancoHorasPage() {
  const [data, setData] = useState({ saldo: 0, entradas: [] })
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filtroAno, setFiltroAno] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroDia, setFiltroDia] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)

  function carregar() {
    const params = {}
    if (filtroAno) params.ano = filtroAno
    if (filtroMes) params.mes = filtroMes
    if (filtroDia) params.dia = filtroDia
    api.get('/banco-horas/', { params }).then(r => setData(r.data))
  }

  useEffect(() => { carregar() }, [filtroAno, filtroMes, filtroDia])

  async function salvar(e) {
    e.preventDefault()
    await api.post('/banco-horas/', form)
    setModal(false)
    setForm(EMPTY_FORM)
    carregar()
  }

  async function excluir(id) {
    if (!confirm('Excluir esta entrada?')) return
    await api.delete(`/banco-horas/${id}/`)
    carregar()
  }

  async function importarCSV(e) {
    const arquivo = e.target.files[0]
    if (!arquivo) return
    setImportando(true)
    setResultadoImport(null)
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    try {
      const r = await api.post('/banco-horas/importar/', formData, {
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

  return (
    <div>
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

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6 flex items-center gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Saldo atual</p>
          <SaldoBadge saldo={data.saldo} />
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm text-slate-400">{data.entradas.length} entradas registradas</p>
          <p className="text-xs text-slate-500 mt-0.5">créditos − débitos</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Horas</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.entradas.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-slate-500 text-center">Nenhuma entrada registrada.</td></tr>
            )}
            {data.entradas.map(e => {
              const h = Math.floor(e.horas)
              const min = Math.round((e.horas - h) * 60)
              return (
                <tr key={e.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{e.descricao}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      e.tipo === 'credito' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {e.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${e.tipo === 'credito' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {e.tipo === 'credito' ? '+' : '-'}{h}h{min > 0 ? ` ${min}min` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => excluir(e.id)}
                      className="text-red-400 hover:text-red-300 text-xs transition-colors">Excluir</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <FormModal titulo="Registrar Horas" onClose={() => setModal(false)} onSubmit={salvar}>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Data</label>
            <input required type="date" value={form.data}
              onChange={e => setForm({ ...form, data: e.target.value })}
              className={inputClass()} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              className={inputClass()}>
              <option value="credito">Crédito (trabalhei a mais)</option>
              <option value="debito">Débito (compensei / saí antes)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Horas (ex: 4.5 = 4h30)</label>
            <input required type="number" step="0.25" min="0.25" value={form.horas}
              onChange={e => setForm({ ...form, horas: e.target.value })}
              className={inputClass()} placeholder="4.5" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Descrição</label>
            <input required value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              className={inputClass()} placeholder="Ex: Sábado 23/05 — deploy emergencial" />
          </div>
        </FormModal>
      )}
    </div>
  )
}
