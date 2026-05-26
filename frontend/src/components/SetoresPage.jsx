import { useEffect, useState } from 'react'
import api from '../api'

function inputClass() {
  return 'bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500'
}

export default function SetoresPage() {
  const [setores, setSetores] = useState([])
  const [novoSetor, setNovoSetor] = useState('')
  const [novaPessoa, setNovaPessoa] = useState({})

  function carregar() {
    api.get('/setores/').then(r => setSetores(r.data))
  }

  useEffect(() => { carregar() }, [])

  async function criarSetor(e) {
    e.preventDefault()
    if (!novoSetor.trim()) return
    await api.post('/setores/', { nome: novoSetor.trim() })
    setNovoSetor('')
    carregar()
  }

  async function excluirSetor(id) {
    if (!confirm('Excluir setor e todas as pessoas deste setor?')) return
    await api.delete(`/setores/${id}/`)
    carregar()
  }

  async function criarPessoa(e, setorId) {
    e.preventDefault()
    const nome = novaPessoa[setorId] || ''
    if (!nome.trim()) return
    await api.post('/pessoas/', { nome: nome.trim(), setor: setorId })
    setNovaPessoa(prev => ({ ...prev, [setorId]: '' }))
    carregar()
  }

  async function excluirPessoa(id) {
    if (!confirm('Excluir esta pessoa?')) return
    await api.delete(`/pessoas/${id}/`)
    carregar()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Setores e Pessoas</h2>
      </div>

      <form onSubmit={criarSetor} className="flex gap-2 mb-6">
        <input
          value={novoSetor}
          onChange={e => setNovoSetor(e.target.value)}
          placeholder="Nome do novo setor"
          className={inputClass() + ' flex-1'}
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Novo Setor
        </button>
      </form>

      {setores.length === 0 && (
        <p className="text-slate-500 text-sm">Nenhum setor cadastrado. Crie um acima.</p>
      )}

      <div className="grid gap-4">
        {setores.map(setor => (
          <div key={setor.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-slate-100 font-medium">{setor.nome}</h3>
              <button onClick={() => excluirSetor(setor.id)}
                className="text-red-400 hover:text-red-300 text-xs transition-colors">
                Excluir setor
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {setor.pessoas.length === 0 && (
                <span className="text-slate-500 text-xs">Nenhuma pessoa neste setor.</span>
              )}
              {setor.pessoas.map(p => (
                <span key={p.id} className="flex items-center gap-1.5 bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-full">
                  {p.nome}
                  <button onClick={() => excluirPessoa(p.id)}
                    className="text-slate-400 hover:text-red-400 transition-colors leading-none">
                    ×
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={e => criarPessoa(e, setor.id)} className="flex gap-2">
              <input
                value={novaPessoa[setor.id] || ''}
                onChange={e => setNovaPessoa(prev => ({ ...prev, [setor.id]: e.target.value }))}
                placeholder="Nome da pessoa"
                className={inputClass() + ' flex-1 py-1.5 text-xs'}
              />
              <button type="submit" className="bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors">
                + Adicionar
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
