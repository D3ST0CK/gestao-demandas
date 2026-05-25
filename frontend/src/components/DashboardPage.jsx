import { useEffect, useState } from 'react'
import api from '../api'

const CATEGORIA_LABEL = { suporte: 'Suporte', tecnico: 'Técnico', rotina: 'Rotina' }
const CATEGORIA_COLOR = {
  suporte: 'bg-amber-500/20 text-amber-400',
  tecnico: 'bg-violet-500/20 text-violet-400',
  rotina: 'bg-emerald-500/20 text-emerald-400',
}
const STATUS_LABEL = { aberta: 'Aberta', andamento: 'Em andamento', concluida: 'Concluída' }
const STATUS_COLOR = {
  aberta: 'text-blue-400',
  andamento: 'text-amber-400',
  concluida: 'text-emerald-400',
}

function SaldoHoras({ saldo }) {
  const negativo = saldo < 0
  const abs = Math.abs(saldo)
  const h = Math.floor(abs)
  const min = Math.round((abs - h) * 60)
  const label = `${negativo ? '-' : '+'}${h}h${min > 0 ? ` ${min}min` : ''}`
  return (
    <span className={negativo ? 'text-red-400' : 'text-blue-400'}>
      {label}
    </span>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    api.get('/dashboard/')
      .then(r => setData(r.data))
      .catch(() => setErro('Não foi possível carregar o dashboard.'))
  }, [])

  if (erro) return <p className="text-red-400">{erro}</p>
  if (!data) return <p className="text-slate-400">Carregando...</p>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-100 mb-6">Dashboard</h2>

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

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Por categoria</h3>
          {Object.entries(data.por_categoria).map(([cat, total]) => (
            <div key={cat} className="flex justify-between items-center py-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[cat]}`}>
                {CATEGORIA_LABEL[cat]}
              </span>
              <span className="text-slate-300 font-medium">{total}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Demandas recentes</h3>
          {data.recentes.length === 0 && (
            <p className="text-slate-500 text-sm">Nenhuma demanda ainda.</p>
          )}
          {data.recentes.map(d => (
            <div key={d.id} className="flex justify-between items-center py-1.5 border-b border-slate-700 last:border-0">
              <span className="text-sm text-slate-200 truncate max-w-[160px]">{d.titulo}</span>
              <div className="flex gap-2 items-center">
                <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[d.categoria]}`}>
                  {CATEGORIA_LABEL[d.categoria]}
                </span>
                <span className={`text-xs ${STATUS_COLOR[d.status]}`}>{STATUS_LABEL[d.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
