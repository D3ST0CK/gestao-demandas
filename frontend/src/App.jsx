import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import DashboardPage from './components/DashboardPage'
import DemandasPage from './components/DemandasPage'
import BancoHorasPage from './components/BancoHorasPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/demandas" element={<DemandasPage />} />
            <Route path="/banco-horas" element={<BancoHorasPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
