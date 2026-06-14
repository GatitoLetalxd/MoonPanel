import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Moon, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react'

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
    <div className="min-h-screen bg-moon-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative lunar glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-moon-accent/5 blur-[120px] -top-40 -right-40" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[100px] -bottom-20 -left-20" />

      <div className="w-full max-w-md bg-moon-surface border border-moon-border/80 p-8 rounded-2xl shadow-2xl relative z-10">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/Moon-icon.png" alt="MoonPanel Logo" className="w-14 h-14 object-contain mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-white tracking-wide">MoonPanel</h2>
          <p className="text-sm text-moon-text/50 font-mono mt-1">moondev.online</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg animate-shake">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
              Usuario o Correo
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-moon-text/40">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="daniel / email@moondev.online"
                className="w-full pl-10 pr-4 py-3 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/30 rounded-xl focus:outline-none transition-all-custom font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-moon-text/40">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-3 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/30 rounded-xl focus:outline-none transition-all-custom font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-moon-text/40 hover:text-white transition-all-custom"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-xl shadow-lg shadow-moon-accent/25 hover:shadow-moon-hover/30 transition-all-custom flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Ingresar al Panel'
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-moon-text/30">
          <p>&copy; {new Date().getFullYear()} MoonPanel. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  )
}
