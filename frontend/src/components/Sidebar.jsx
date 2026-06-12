import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Server, 
  Key, 
  LogOut, 
  Terminal
} from 'lucide-react'

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const activeStyle = "flex items-center gap-3 px-4 py-3 bg-moon-accent text-white font-medium rounded-lg shadow-lg shadow-moon-accent/20 transition-all-custom"
  const inactiveStyle = "flex items-center gap-3 px-4 py-3 text-moon-text/70 hover:text-white hover:bg-moon-border/40 rounded-lg transition-all-custom"

  return (
    <aside className="w-64 bg-moon-surface border-r border-moon-border flex flex-col justify-between h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <img src="/Moon-icon.png" alt="MoonPanel Logo" className="w-8 h-8 object-contain rounded-lg" />
          <div>
            <h1 className="font-bold text-lg leading-tight text-white tracking-wide">MoonPanel</h1>
            <span className="text-xs text-moon-accent font-semibold tracking-wider font-mono">moondev.online</span>
          </div>
        </div>

        {/* User badge */}
        <div className="mb-8 p-4 bg-moon-card rounded-lg border border-moon-border/60">
          <p className="text-xs text-moon-text/50 font-mono uppercase tracking-wider">Usuario</p>
          <p className="font-semibold text-white truncate">{user?.username}</p>
          <span className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full ${
            isAdmin ? 'bg-purple-900/40 text-purple-300 border border-purple-800' : 'bg-blue-900/40 text-blue-300 border border-blue-800'
          }`}>
            {isAdmin ? 'ADMINISTRADOR' : 'CLIENTE'}
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-2">
          {isAdmin ? (
            <>
              <NavLink 
                to="/admin/dashboard" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </NavLink>

              <NavLink 
                to="/admin/clients" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                <Users size={20} />
                <span>Clientes</span>
              </NavLink>

              <NavLink 
                to="/admin/create-client" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                <UserPlus size={20} />
                <span>Crear Cliente</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink 
                to="/client/my-instance" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                <Server size={20} />
                <span>Mi Instancia</span>
              </NavLink>

              <NavLink 
                to="/client/ssh-keys" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                <Key size={20} />
                <span>Llaves SSH</span>
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* Logout button */}
      <div className="p-6">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 rounded-lg font-medium transition-all-custom"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  )
}
