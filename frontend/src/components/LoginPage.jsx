import { useState } from 'react'
import api from '../api'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const r = await api.post('/auth/login/', { username, password })
      localStorage.setItem('auth_token', r.data.token)
      onLogin()
    } catch {
      setErro('Usuário ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-slate-100 mb-1">Gestão de Demandas</h1>
        <p className="text-sm text-slate-400 mb-6">Faça login para continuar</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Usuário</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Senha</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500" />
          </div>
          {erro && <p className="text-red-400 text-xs">{erro}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
