import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import InstanceSelector from './InstanceSelector'
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Server, 
  Key, 
  LogOut, 
  GitBranch,
  Gamepad2
} from 'lucide-react'

export default function Sidebar({ onCloseMobile }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    if (onCloseMobile) onCloseMobile()
    await logout()
    navigate('/login')
  }

  const handleNavClick = () => {
    if (onCloseMobile) onCloseMobile()
  }

  const activeStyle = "flex items-center gap-3 px-4 py-3 bg-blue-600/10 border border-blue-500/30 text-white font-semibold rounded-lg shadow-[0_0_12px_rgba(37,99,235,0.2)] transition-all-custom cursor-pointer"
  const inactiveStyle = "flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 rounded-lg transition-all-custom cursor-pointer"

  return (
    <aside className="w-64 bg-moon-surface border-r border-moon-border flex flex-col justify-between h-screen sticky top-0 select-none">
      <div className="p-6">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/Moon-icon.png" alt="MoonPanel Logo" className="w-9 h-9 object-contain rounded-lg filter drop-shadow-[0_0_6px_rgba(37,99,235,0.4)]" />
          <div>
            <h1 className="font-bold text-lg leading-tight text-white tracking-wider font-sans neon-glow-blue">MOONPANEL</h1>
            <span className="text-[10px] text-blue-400 font-bold tracking-widest font-mono">MOONDEV.ONLINE</span>
          </div>
        </div>

        {/* User badge */}
        <div className="mb-8 p-4 bg-moon-card/40 rounded-lg border border-moon-border flex flex-col gap-1 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-500/80 rounded-bl-sm" />
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Identidad</p>
          <p className="font-semibold text-white truncate font-mono text-sm">{user?.username}</p>
          <div>
            <span className={`inline-block mt-2 px-2.5 py-0.5 text-[9px] font-bold rounded font-sans tracking-widest uppercase ${
              isAdmin 
                ? 'bg-fuchsia-950/20 text-fuchsia-400 border border-fuchsia-500/25 shadow-[0_0_6px_rgba(217,70,239,0.1)]' 
                : 'bg-blue-950/20 text-blue-400 border border-blue-500/25 shadow-[0_0_6px_rgba(37,99,235,0.1)]'
            }`}>
              {isAdmin ? 'ADMINISTRADOR' : 'CLIENTE'}
            </span>
          </div>
          {!isAdmin && (
            <div className="mt-4 pt-4 border-t border-moon-border">
              <InstanceSelector />
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-2">
          {isAdmin ? (
            <>
              <NavLink 
                to="/admin/dashboard" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                onClick={handleNavClick}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                <span className="text-xs uppercase tracking-wider font-sans">Dashboard</span>
              </NavLink>

              <NavLink 
                to="/admin/clients" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                onClick={handleNavClick}
              >
                <Users size={18} className="shrink-0" />
                <span className="text-xs uppercase tracking-wider font-sans">Clientes</span>
              </NavLink>

              <NavLink 
                to="/admin/create-client" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                onClick={handleNavClick}
              >
                <UserPlus size={18} className="shrink-0" />
                <span className="text-xs uppercase tracking-wider font-sans">Crear Cliente</span>
              </NavLink>

              <NavLink 
                to="/admin/game-servers" 
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                onClick={handleNavClick}
              >
                <Gamepad2 size={18} className="shrink-0" />
                <span className="text-xs uppercase tracking-wider font-sans">Servidores</span>
              </NavLink>
            </>
          ) : (
            <>
              {user?.instances && user.instances.length > 0 && (
                <>
                  <NavLink 
                    to="/client/my-instance" 
                    className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                    onClick={handleNavClick}
                  >
                    <Server size={18} className="shrink-0" />
                    <span className="text-xs uppercase tracking-wider font-sans">Mi Instancia</span>
                  </NavLink>

                  <NavLink 
                    to="/client/ssh-keys" 
                    className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                    onClick={handleNavClick}
                  >
                    <Key size={18} className="shrink-0" />
                    <span className="text-xs uppercase tracking-wider font-sans">Llaves SSH</span>
                  </NavLink>

                  <NavLink 
                    to="/client/deployments" 
                    className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                    onClick={handleNavClick}
                  >
                    <GitBranch size={18} className="shrink-0" />
                    <span className="text-xs uppercase tracking-wider font-sans">Despliegues</span>
                  </NavLink>
                </>
              )}

              {user?.userGameAccess && user.userGameAccess.length > 0 && (
                <NavLink 
                  to="/game" 
                  className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
                  onClick={handleNavClick}
                >
                  <Gamepad2 size={18} className="shrink-0" />
                  <span className="text-xs uppercase tracking-wider font-sans">Juegos</span>
                </NavLink>
              )}
            </>
          )}
        </nav>
      </div>

      {/* Logout button */}
      <div className="p-6">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-950/15 border border-rose-500/10 hover:border-rose-500/30 rounded-lg text-xs font-semibold uppercase tracking-wider font-sans transition-all-custom cursor-pointer shadow-sm hover:shadow-rose-500/5"
        >
          <LogOut size={16} />
          <span>Salir</span>
        </button>
      </div>
    </aside>
  )
}
