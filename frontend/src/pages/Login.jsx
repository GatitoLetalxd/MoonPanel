import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userData = await login(username, password)
      if (userData.role === 'ADMIN') {
        navigate('/admin/dashboard')
      } else {
        const hostname = window.location.hostname
        const isGameSubdomain = hostname.startsWith('vh.') || hostname.startsWith('mc.')
        const hasVps = userData.instances && userData.instances.length > 0
        const hasGame = userData.userGameAccess && userData.userGameAccess.length > 0
        
        if (isGameSubdomain || (!hasVps && hasGame)) {
          navigate('/game')
        } else {
          navigate('/client/my-instance')
        }
      }
    } catch (err) {
      console.error('[LOGIN ERROR]', err)
      const errorMsg = err.response?.data?.error || 'No se pudo conectar al servidor. Intente más tarde.'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-moon-bg flex items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Decorative neon cyberpunk glows */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[120px] -top-40 -right-40" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-rose-500/5 blur-[100px] -bottom-20 -left-20" />
      
      {/* HUD corner borders */}
      <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-blue-500/20 pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-blue-500/20 pointer-events-none" />

      <div className="w-full max-w-md bg-moon-surface/60 border border-blue-500/15 p-8 rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.08)] relative z-10 backdrop-blur-md">
        
        {/* Corner tech dots */}
        <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500/50 rounded-bl-sm" />
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-blue-500/50 rounded-tr-sm" />

        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/Moon-icon.png" alt="MoonPanel Logo" className="w-14 h-14 object-contain mb-4 filter drop-shadow-[0_0_8px_rgba(37,99,235,0.3)]" />
          <h2 className="text-2xl font-bold text-white tracking-widest font-sans neon-glow-blue uppercase">MOONPANEL</h2>
          <p className="text-[10px] text-blue-400 font-bold tracking-widest font-mono mt-1">SISTEMA DE ACCESO HUD</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-rose-500/5 border border-rose-500/20 text-rose-400 text-xs rounded-lg font-mono">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-sans">
              Credencial / Correo
            </label>
            <div className="relative border-glow-blue border rounded-lg bg-black/45 overflow-hidden transition-all-custom">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="daniel / email@moondev.online"
                className="w-full pl-10 pr-4 py-3 bg-transparent text-white placeholder-slate-600 focus:outline-none font-mono text-xs cursor-text"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-sans">
              Clave de Acceso
            </label>
            <div className="relative border-glow-blue border rounded-lg bg-black/45 overflow-hidden transition-all-custom">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-3 bg-transparent text-white placeholder-slate-600 focus:outline-none font-mono text-xs cursor-text"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white transition-all-custom cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md shadow-blue-600/10 hover:shadow-blue-500/25 transition-all-custom flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider text-xs font-sans"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Ingresar al Servidor'
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 text-center text-[10px] text-slate-600 font-mono tracking-wider">
          <p>&copy; {new Date().getFullYear()} MOONDEV SYSTEM. CORE v1.0.0</p>
        </div>
      </div>
    </div>
  )
}
