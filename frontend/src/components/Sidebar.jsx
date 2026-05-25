import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/demandas', label: 'Demandas', icon: '📋' },
  { to: '/banco-horas', label: 'Banco de Horas', icon: '⏱' },
]

export default function Sidebar() {
  return (
    <aside className="w-52 min-h-screen bg-slate-900 border-r border-slate-700 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-700">
        <h1 className="text-sm font-semibold text-slate-200 leading-tight">Gestão de<br />Demandas</h1>
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-slate-700">
        <button
          onClick={() => window.open('/demandas', '_self')}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors"
        >
          + Nova Demanda
        </button>
      </div>
    </aside>
  )
}
