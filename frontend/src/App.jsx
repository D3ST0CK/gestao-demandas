import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import DashboardPage from './components/DashboardPage'
import DemandasPage from './components/DemandasPage'
import BancoHorasPage from './components/BancoHorasPage'
import SetoresPage from './components/SetoresPage'
import LoginPage from './components/LoginPage'

export default function App() {
  const [autenticado, setAutenticado] = useState(() => !!localStorage.getItem('auth_token'))

  if (!autenticado) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={() => setAutenticado(true)} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar onLogout={() => { localStorage.removeItem('auth_token'); setAutenticado(false) }} />
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/demandas" element={<DemandasPage />} />
            <Route path="/banco-horas" element={<BancoHorasPage />} />
            <Route path="/setores" element={<SetoresPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
