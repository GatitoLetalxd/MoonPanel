import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Copy, Check, Server, Eye, EyeOff, Globe, Ban } from 'lucide-react'
import api from '../../api/axios'

export default function CreateClient() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState('SSH')
  const [database, setDatabase] = useState('NONE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Lista de subdominios predefinidos y verificación de uso
  const [existingClients, setExistingClients] = useState([])
  const [fetchingClients, setFetchingClients] = useState(true)

  const SUBDOMAINS = ['user01', 'user02', 'user03', 'user04', 'user05', 'user06', 'user07', 'user08', 'user09', 'user10']

  useEffect(() => {
    const fetchExistingClients = async () => {
      try {
        const response = await api.get('/api/admin/clients')
        setExistingClients(response.data)
      } catch (err) {
        console.error('[FETCH EXISTING CLIENTS ERROR]', err)
      } finally {
        setFetchingClients(false)
      }
    }
    fetchExistingClients()
  }, [])

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

    if (!username) {
      setError('Por favor selecciona uno de los subdominios predefinidos.')
      setLoading(false)
      return
    }

    const cleanUsername = username.trim().toLowerCase()
    
    // Verificar doblemente que no esté en uso
    const isInUse = existingClients.some(c => c.username.toLowerCase() === cleanUsername)
    if (isInUse) {
      setError(`El subdominio ${cleanUsername}.moondev.online ya está en uso por otro cliente.`)
      setLoading(false)
      return
    }

    try {
      const response = await api.post('/api/admin/clients', {
        username: cleanUsername,
        email: email.trim(),
        password,
        mode,
        database
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
          <p className="text-sm text-moon-text/50 font-mono">Seleccionar subdominio y desplegar contenedor automático para moondev.online</p>
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

            {/* Subdomain selector section */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                Selecciona un Subdominio Disponible (user01 - user10)
              </label>
              
              {fetchingClients ? (
                <div className="flex items-center gap-2 py-4 font-mono text-xs text-moon-text/50">
                  <span className="w-4 h-4 border-2 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
                  <span>Verificando disponibilidad de subdominios...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {SUBDOMAINS.map((sub) => {
                    const isInUse = existingClients.some(c => c.username.toLowerCase() === sub.toLowerCase());
                    const isSelected = username === sub;
                    
                    return (
                      <button
                        key={sub}
                        type="button"
                        disabled={isInUse}
                        onClick={() => setUsername(sub)}
                        className={`p-3 rounded-lg border text-xs font-mono flex flex-col items-center justify-center gap-1.5 transition-all-custom ${
                          isInUse 
                            ? 'bg-rose-950/10 border-rose-900/10 text-rose-400/50 cursor-not-allowed opacity-50' 
                            : isSelected
                              ? 'bg-moon-accent border-moon-accent text-white shadow-lg shadow-moon-accent/20 font-bold scale-105'
                              : 'bg-moon-card border-moon-border hover:border-moon-accent/40 text-moon-text hover:text-white'
                        }`}
                      >
                        <span className="font-semibold">{sub}</span>
                        {isInUse ? (
                          <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 px-1 py-0.5 rounded text-rose-400 flex items-center gap-0.5"><Ban size={8} /> Ocupado</span>
                        ) : isSelected ? (
                          <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded text-white font-bold flex items-center gap-0.5"><Check size={8} /> Activo</span>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded text-emerald-400 flex items-center gap-0.5"><Globe size={8} /> Disponible</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              
              {username && (
                <span className="text-[10px] text-moon-text/40 font-mono block">
                  Subdominio asignado: <span className="text-moon-accent font-semibold">{username}.moondev.online</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Modo de Instancia
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white rounded-lg focus:outline-none transition-all-custom font-mono text-sm"
                >
                  <option value="SSH">SSH Manual</option>
                  <option value="AUTO_DEPLOY">Despliegue Automático (GitHub)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Motor de Base de Datos
                </label>
                <select
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white rounded-lg focus:outline-none transition-all-custom font-mono text-sm"
                >
                  <option value="NONE">Ninguno</option>
                  <option value="POSTGRES">PostgreSQL</option>
                  <option value="MYSQL">MySQL</option>
                </select>
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
                  <span className="text-moon-text/50">Modo de Instancia:</span>
                  <span className="text-white font-semibold">{provisionedData.instance?.mode === 'AUTO_DEPLOY' ? 'Despliegue Automático (GitHub)' : 'SSH Manual'}</span>
                </div>
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Base de Datos:</span>
                  <span className="text-white font-semibold">{provisionedData.instance?.database}</span>
                </div>
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Puerto Web Externo:</span>
                  <span className="text-white font-semibold">{provisionedData.instance?.webPort}</span>
                </div>
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Puerto SSH Externo:</span>
                  <span className="text-white font-semibold">{provisionedData.instance?.sshPort}</span>
                </div>
                {provisionedData.instance?.database !== 'NONE' && (
                  <div className="flex justify-between border-b border-moon-border/40 pb-2">
                    <span className="text-moon-text/50">Puerto BD Externo:</span>
                    <span className="text-white font-semibold">{provisionedData.instance?.dbPort}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-moon-border/40 pb-2">
                  <span className="text-moon-text/50">Nombre Contenedor:</span>
                  <span className="text-white">{provisionedData.instance?.containerName}</span>
                </div>
                
                {provisionedData.instance?.database !== 'NONE' && (
                  <div className="pt-2">
                    <span className="text-moon-text/50 block mb-1.5">Contraseña de Base de Datos ({provisionedData.instance?.database === 'POSTGRES' ? 'Usuario: postgres' : 'Usuario: root'}):</span>
                    <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-3 rounded-lg">
                      <span className="text-white select-all font-bold tracking-wider">{provisionedData.instance?.dbPassword}</span>
                      <button
                        onClick={() => handleCopy(provisionedData.instance?.dbPassword, 'dbPassword')}
                        className="p-1.5 hover:bg-moon-border text-moon-text/60 hover:text-white rounded transition-all-custom"
                        title="Copiar contraseña de BD"
                      >
                        {copiedKey === 'dbPassword' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                )}
                
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
