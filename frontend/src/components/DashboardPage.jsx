import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../api'

const CATEGORIA_LABEL = { suporte: 'Suporte', tecnico: 'Técnico', rotina: 'Rotina' }
const CATEGORIA_COLOR = {
  suporte: 'bg-amber-500/20 text-amber-400',
  tecnico: 'bg-violet-500/20 text-violet-400',
  rotina: 'bg-emerald-500/20 text-emerald-400',
}
const CATEGORIA_BAR_COLOR = { suporte: '#f59e0b', tecnico: '#8b5cf6', rotina: '#10b981' }
const STATUS_LABEL = { aberta: 'Aberta', andamento: 'Em andamento', concluida: 'Concluída' }
const STATUS_COLOR = {
  aberta: 'text-blue-400',
  andamento: 'text-amber-400',
  concluida: 'text-emerald-400',
}

function formatarSaldo(saldo) {
  const neg = saldo < 0
  const abs = Math.abs(saldo)
  const h = Math.floor(abs)
  const min = Math.round((abs - h) * 60)
  return `${neg ? '-' : '+'}${h}h${min > 0 ? ` ${min}min` : ''}`
}

function SaldoHoras({ saldo }) {
  return (
    <span className={saldo < 0 ? 'text-red-400' : 'text-blue-400'}>
      {formatarSaldo(saldo)}
    </span>
  )
}

function TooltipCustom({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold">{payload[0].value} demanda{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

function gerarPDF(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const largura = doc.internal.pageSize.getWidth()
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, largura, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório Operacional', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(`Gerado em ${dataGeracao}`, 14, 20)
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo Executivo', 14, 40)
  const total = data.total || 0
  autoTable(doc, {
    startY: 44,
    head: [['Indicador', 'Valor']],
    body: [
      ['Demandas Abertas', String(data.demandas_abertas)],
      ['Em Andamento', String(data.em_andamento)],
      [`Concluídas (${data.taxa_conclusao}% de ${total})`, String(data.concluidas)],
      ['Saldo Banco de Horas', formatarSaldo(data.saldo_banco_horas)],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })
  const y1 = doc.lastAutoTable.finalY + 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Distribuição por Categoria', 14, y1)
  autoTable(doc, {
    startY: y1 + 4,
    head: [['Categoria', 'Qtd.', '% do Total']],
    body: Object.entries(data.por_categoria).map(([cat, qtd]) => [
      CATEGORIA_LABEL[cat] || cat, String(qtd),
      total > 0 ? `${Math.round((qtd / total) * 100)}%` : '—',
    ]),
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  })
  const y2 = doc.lastAutoTable.finalY + 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Demandas Recentes', 14, y2)
  autoTable(doc, {
    startY: y2 + 4,
    head: [['Título', 'Categoria', 'Status']],
    body: data.recentes.length
      ? data.recentes.map(d => [d.titulo, CATEGORIA_LABEL[d.categoria] || d.categoria, STATUS_LABEL[d.status] || d.status])
      : [['Nenhuma demanda registrada.', '', '']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  })
  const altura = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(`Gerado automaticamente em ${dataGeracao}`, largura / 2, altura - 8, { align: 'center' })
  doc.save(`relatorio-operacional-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [erro, setErro] = useState(null)
  const [periodoGrafico, setPeriodoGrafico] = useState('30d')

  useEffect(() => {
    api.get('/dashboard/')
      .then(r => setData(r.data))
      .catch(() => setErro('Não foi possível carregar o dashboard.'))
  }, [])

  if (erro) return <p className="text-red-400">{erro}</p>
  if (!data) return <p className="text-slate-400">Carregando...</p>

  const dadosDia = periodoGrafico === '7d' ? data.por_dia.slice(-7) : data.por_dia
  const dadosSemana = data.por_semana

  const dadosCategoria = Object.entries(data.por_categoria).map(([cat, total]) => ({
    name: CATEGORIA_LABEL[cat],
    total,
    cor: CATEGORIA_BAR_COLOR[cat],
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Dashboard</h2>
        <button
          onClick={() => gerarPDF(data)}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-slate-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><rect x="3" y="19" width="18" height="2" rx="1"/>
          </svg>
          Exportar PDF
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-3xl font-bold text-emerald-400">{data.demandas_abertas}</p>
          <p className="text-sm text-slate-400 mt-1">Abertas</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-3xl font-bold text-amber-400">{data.em_andamento}</p>
          <p className="text-sm text-slate-400 mt-1">Em andamento</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-3xl font-bold text-violet-400">{data.concluidas}</p>
          <p className="text-sm text-slate-400 mt-1">
            Concluídas
            {data.total > 0 && <span className="ml-2 text-xs text-slate-500">{data.taxa_conclusao}%</span>}
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-3xl font-bold"><SaldoHoras saldo={data.saldo_banco_horas} /></p>
          <p className="text-sm text-slate-400 mt-1">Banco de horas</p>
        </div>
      </div>

      {/* Gráfico de barras por dia */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-slate-300">Demandas por dia</h3>
          <div className="flex gap-1">
            {['7d', '30d'].map(p => (
              <button key={p} onClick={() => setPeriodoGrafico(p)}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${periodoGrafico === p ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {p === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dadosDia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
              interval={periodoGrafico === '30d' ? 4 : 0} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<TooltipCustom />} cursor={{ fill: '#1e293b' }} />
            <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de linha por semana + por categoria */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Demandas por semana (últimas 8)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dadosSemana} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipCustom />} />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Por categoria</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dadosCategoria} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<TooltipCustom />} cursor={{ fill: '#1e293b' }} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {dadosCategoria.map((entry, i) => (
                  <Cell key={i} fill={entry.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Demandas recentes */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Demandas recentes</h3>
        {data.recentes.length === 0 && <p className="text-slate-500 text-sm">Nenhuma demanda ainda.</p>}
        {data.recentes.map(d => (
          <div key={d.id} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-sm text-slate-200 truncate max-w-[200px]">{d.titulo}</span>
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
  )
}
