import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Copy, Check, Server, Eye, EyeOff } from 'lucide-react'
import api from '../../api/axios'

export default function CreateClient() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Guardar datos aprovisionados tras la creación exitosa
  const [provisionedData, setProvisionedData] = useState(null)
  const [copiedKey, setCopiedKey] = useState('')

  const navigate = useNavigate()

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validar nombre de usuario
    const cleanUsername = username.trim().toLowerCase()
    const regex = /^[a-z0-9-]+$/
    if (!regex.test(cleanUsername) || cleanUsername.length < 3 || cleanUsername.length > 30) {
      setError('El nombre de usuario debe tener de 3 a 30 caracteres y solo contener letras minúsculas, números y guiones.')
      setLoading(false)
      return
    }

    try {
      const response = await api.post('/api/admin/clients', {
        username: cleanUsername,
        email: email.trim(),
        password
      })
      
      setProvisionedData(response.data)
    } catch (err) {
      console.error('[CREATE CLIENT ERROR]', err)
      setError(err.response?.data?.error || 'Error al aprovisionar el cliente. Por favor verifica los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 p-8 bg-moon-bg min-h-screen">
      {/* Back button and header */}
      <div className="mb-8 flex items-center gap-4">
        <Link 
          to="/admin/clients"
          className="p-2.5 bg-moon-surface border border-moon-border hover:border-moon-accent/40 text-moon-text hover:text-white rounded-lg transition-all-custom"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Aprovisionar Cliente</h2>
          <p className="text-sm text-moon-text/50 font-mono">Crear cuenta y desplegar contenedor automático para moondev.online</p>
        </div>
      </div>

      <div className="max-w-2xl bg-moon-surface border border-moon-border p-8 rounded-xl shadow-xl">
        {!provisionedData ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Nombre de Usuario (Subdominio)
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
                    placeholder="ej: daniel"
                    className="w-full pl-10 pr-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/20 rounded-lg focus:outline-none transition-all-custom font-mono text-sm"
                  />
                </div>
                <span className="text-[10px] text-moon-text/40 font-mono mt-1 block">
                  Se convertirá en: <span className="text-moon-accent">{username.trim().toLowerCase() || '...'}.moondev.online</span>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-moon-text/40">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/20 rounded-lg focus:outline-none transition-all-custom font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                Contraseña del Panel de Cliente
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
                  placeholder="Contraseña del panel"
                  className="w-full pl-10 pr-10 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/20 rounded-lg focus:outline-none transition-all-custom font-mono text-sm"
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
              className="w-full py-3.5 px-4 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-lg shadow-lg shadow-moon-accent/25 transition-all-custom flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Aprovisionando contenedor Docker e instalando SSH...</span>
                </div>
              ) : (
                'Confirmar y Desplegar Instancia'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6 animate-scale-up">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg flex items-center gap-2 font-mono">
              <Server size={18} className="animate-bounce" />
              <span>¡Instancia aprovisionada con éxito!</span>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-white text-base">Detalles del Contenedor de {provisionedData.client?.username}</h3>
              
              <div className="bg-moon-card border border-moon-border rounded-lg p-5 space-y-3.5 text-sm font-mono">
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Subdominio:</span>
                  <span className="text-moon-accent font-semibold">{provisionedData.instance?.subdomain}.moondev.online</span>
                </div>
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Puerto Web Externo:</span>
                  <span className="text-white font-semibold">{provisionedData.instance?.webPort}</span>
                </div>
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Puerto SSH Externo:</span>
                  <span className="text-white font-semibold">{provisionedData.instance?.sshPort}</span>
                </div>
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Nombre Contenedor:</span>
                  <span className="text-white">{provisionedData.instance?.containerName}</span>
                </div>
                
                {/* Contraseña SSH Temporal */}
                <div className="pt-2">
                  <span className="text-moon-text/50 block mb-1.5">Contraseña SSH Temporal (GatitoLetal, pásale esto al cliente):</span>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-3 rounded-lg">
                    <span className="text-white select-all font-bold tracking-wider">{provisionedData.instance?.sshPassword}</span>
                    <button
                      onClick={() => handleCopy(provisionedData.instance?.sshPassword, 'sshPassword')}
                      className="p-1.5 hover:bg-moon-border text-moon-text/60 hover:text-white rounded transition-all-custom"
                      title="Copiar contraseña"
                    >
                      {copiedKey === 'sshPassword' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Comando SSH de conexión */}
                <div className="pt-2">
                  <span className="text-moon-text/50 block mb-1.5">Comando de conexión SSH:</span>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-3 rounded-lg">
                    <span className="text-white select-all text-xs">ssh root@moondev.online -p {provisionedData.instance?.sshPort}</span>
                    <button
                      onClick={() => handleCopy(`ssh root@moondev.online -p ${provisionedData.instance?.sshPort}`, 'sshCmd')}
                      className="p-1.5 hover:bg-moon-border text-moon-text/60 hover:text-white rounded transition-all-custom"
                      title="Copiar comando"
                    >
                      {copiedKey === 'sshCmd' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setProvisionedData(null)
                  setUsername('')
                  setEmail('')
                  setPassword('')
                }}
                className="flex-1 py-3 px-4 bg-moon-card hover:bg-moon-border/60 text-white font-semibold border border-moon-border rounded-lg text-sm transition-all-custom"
              >
                Aprovisionar Otro
              </button>
              <button
                onClick={() => navigate('/admin/clients')}
                className="flex-1 py-3 px-4 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-lg text-sm transition-all-custom"
              >
                Volver a la Lista
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
