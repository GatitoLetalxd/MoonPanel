import React, { useState, useEffect, useRef } from 'react'
import { Server, GitBranch, Rocket, Plus, Trash2, Copy, Check, Eye, EyeOff, Terminal, X, AlertCircle, Play } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import api from '../../api/axios'

export default function Deployments() {
  const [instance, setInstance] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Deploy fields
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [deployLoading, setDeployLoading] = useState(false)
  const [deployments, setDeployments] = useState([])

  // EnvVars fields
  const [envVars, setEnvVars] = useState([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [showValues, setShowValues] = useState({}) // id -> boolean
  const [envLoading, setEnvLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')

  // SSE Logs Terminal fields
  const [activeDeploymentId, setActiveDeploymentId] = useState(null)
  const [logs, setLogs] = useState('')
  const [activeStatus, setActiveStatus] = useState('')
  const [activeProjType, setActiveProjType] = useState('')
  const terminalEndRef = useRef(null)
  const eventSourceRef = useRef(null)

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  const toggleShowValue = (id) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const fetchData = async () => {
    try {
      // Get client instance
      const instRes = await api.get('/api/client/instance')
      setInstance(instRes.data.instance)

      if (instRes.data.instance && instRes.data.instance.mode === 'AUTO_DEPLOY') {
        // Fetch env vars
        const envRes = await api.get('/api/client/envvars')
        setEnvVars(envRes.data)

        // Fetch deployments history
        const deployRes = await api.get('/api/client/deployments')
        setDeployments(deployRes.data)
        
        // Auto-fill repo if they have a past deploy
        if (deployRes.data.length > 0) {
          setRepoUrl(deployRes.data[0].repoUrl)
          setBranch(deployRes.data[0].branch)
        }
      }
    } catch (error) {
      console.error('[DEPLOYMENTS FETCH ERROR]', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  // Auto scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // EnvVars operations
  const handleAddEnvVar = async (e) => {
    e.preventDefault()
    if (!newKey.trim()) return
    setEnvLoading(true)
    try {
      const response = await api.post('/api/client/envvars', {
        key: newKey.trim().toUpperCase(),
        value: newValue
      })
      setEnvVars(prev => {
        const index = prev.findIndex(v => v.key === response.data.envVar.key)
        if (index > -1) {
          const updated = [...prev]
          updated[index] = response.data.envVar
          return updated
        }
        return [...prev, response.data.envVar]
      })
      setNewKey('')
      setNewValue('')
    } catch (err) {
      alert(`Error al guardar variable: ${err.response?.data?.error || err.message}`)
    } finally {
      setEnvLoading(false)
    }
  }

  const handleDeleteEnvVar = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta variable de entorno?')) return
    try {
      await api.delete(`/api/client/envvars/${id}`)
      setEnvVars(prev => prev.filter(v => v.id !== id))
    } catch (err) {
      alert(`Error al eliminar variable: ${err.response?.data?.error || err.message}`)
    }
  }

  // Deploy operations
  const handleTriggerDeploy = async (e) => {
    e.preventDefault()
    if (!repoUrl.trim()) return
    setDeployLoading(true)
    try {
      const response = await api.post('/api/client/deploy', {
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || 'main'
      })
      
      const newDeploy = response.data.deployment
      setDeployments(prev => [newDeploy, ...prev])
      
      // Auto open terminal logs
      handleViewLogs(newDeploy.id)
    } catch (err) {
      alert(`Error al iniciar despliegue: ${err.response?.data?.error || err.message}`)
    } finally {
      setDeployLoading(false)
    }
  }

  // Connect to SSE for logs
  const handleViewLogs = (deployId) => {
    // Disconnect old SSE if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setActiveDeploymentId(deployId)
    setLogs('Estableciendo conexión en tiempo real con la consola del contenedor...\n')
    
    const token = localStorage.getItem('token')
    const es = new EventSource(`/api/client/deploy/logs/${deployId}?token=${token}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'history') {
          setLogs(data.text)
        } else if (data.type === 'log') {
          setLogs(prev => prev + data.text)
        } else if (data.type === 'status') {
          setActiveStatus(data.status)
          if (data.projectType) {
            setActiveProjType(data.projectType)
          }
          // Update list status
          setDeployments(prev => prev.map(d => d.id === deployId ? { ...d, status: data.status, projectType: data.projectType || d.projectType } : d))
        } else if (data.type === 'end') {
          setLogs(prev => prev + '\n[CONEXIÓN FINALIZADA CON ÉXITO]\n')
          es.close()
        } else if (data.type === 'error') {
          setLogs(prev => prev + `\n[SSE ERROR] ${data.message}\n`)
          es.close()
        }
      } catch (err) {
        console.error('Error parsing SSE event data:', err)
      }
    }

    es.onerror = () => {
      setLogs(prev => prev + '\n[INFO] La transmisión en vivo terminó o se desconectó. Mostrando logs estáticos.\n')
      es.close()
    }
  }

  const handleCloseLogs = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    setActiveDeploymentId(null)
    setLogs('')
    setActiveStatus('')
    setActiveProjType('')
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando Despliegues...</span>
        </div>
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="flex-1 p-8 bg-moon-bg min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-moon-surface border border-moon-border p-8 rounded-xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Server size={20} />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">Sin Entorno Activo</h3>
          <p className="text-xs text-moon-text/50 font-mono">
            Aún no tienes una instancia asignada. Comunícate con el administrador para activar tu servidor.
          </p>
        </div>
      </div>
    )
  }

  // Render limit notice if not in AUTO_DEPLOY mode
  if (instance.mode !== 'AUTO_DEPLOY') {
    return (
      <div className="flex-1 p-8 bg-moon-bg min-h-screen flex items-center justify-center">
        <div className="text-center max-w-2xl bg-moon-surface border border-moon-border p-10 rounded-xl shadow-xl space-y-6">
          <div className="w-16 h-16 bg-moon-accent/10 text-moon-accent rounded-full border border-moon-border flex items-center justify-center mx-auto">
            <GitBranch size={32} />
          </div>
          <h3 className="font-bold text-white text-xl">Modo Despliegue Automático Deshabilitado</h3>
          <p className="text-sm text-moon-text/60 leading-relaxed font-mono">
            Tu servidor está configurado actualmente en modo <span className="text-white font-bold">SSH Manual</span>. 
            <br />
            Para poder importar directamente repositorios públicos de GitHub, auto-detectar lenguajes (NodeJS, React, Python, HTML), inyectar variables de entorno cifradas de forma segura y ver la consola de compilación en tiempo real, ponte en contacto con <span className="text-moon-accent font-semibold">GatitoLetal</span> para habilitar el modo Despliegue Automático en tu cuenta.
          </p>
          <div className="p-4 bg-moon-card rounded-lg border border-moon-border/60 text-xs font-mono text-moon-text/50">
            Puedes seguir conectándote por terminal usando el comando SSH provisto en la sección <span className="text-white font-bold">Mi Instancia</span>.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 bg-moon-bg min-h-screen relative">
      
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-wide">Repositorio y Despliegues</h2>
        <p className="text-sm text-moon-text/50 font-mono mt-0.5">
          Configura tus variables de entorno, importa repositorios públicos de GitHub y compila de forma automatizada.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (Config & Deploy history) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* GitHub configuration form */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-6">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Rocket size={18} className="text-moon-accent" />
              <span>Desplegar Nuevo Repositorio</span>
            </h3>

            <form onSubmit={handleTriggerDeploy} className="space-y-4 font-mono text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-moon-text/75 uppercase">Repositorio GitHub (Público)</label>
                  <input
                    type="url"
                    required
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/usuario/mi-proyecto"
                    className="w-full px-4 py-2.5 bg-moon-card border border-moon-border rounded-lg text-white placeholder-moon-text/25 focus:outline-none focus:border-moon-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-moon-text/75 uppercase">Rama (Branch)</label>
                  <input
                    type="text"
                    required
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-4 py-2.5 bg-moon-card border border-moon-border rounded-lg text-white placeholder-moon-text/25 focus:outline-none focus:border-moon-accent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={deployLoading || !repoUrl}
                className="px-6 py-3 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white font-bold rounded-lg shadow-lg shadow-moon-accent/25 transition-all-custom flex items-center gap-2 text-xs uppercase tracking-wider"
              >
                {deployLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Iniciando...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Importar y Desplegar</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Deployment History list */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-6 flex items-center gap-2">
              <Terminal size={18} className="text-moon-accent" />
              <span>Historial de Despliegues</span>
            </h3>

            {deployments.length === 0 ? (
              <div className="py-12 border border-dashed border-moon-border rounded-lg bg-moon-card/30 text-center font-mono text-xs text-moon-text/40">
                Aún no has realizado ningún despliegue automático. Configura tu repositorio arriba para comenzar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-moon-border/60 text-moon-text/40 uppercase tracking-wider text-[10px]">
                      <th className="pb-3 font-semibold">Proyecto / Rama</th>
                      <th className="pb-3 font-semibold">Tipo</th>
                      <th className="pb-3 font-semibold">Fecha</th>
                      <th className="pb-3 font-semibold">Estado</th>
                      <th className="pb-3 font-semibold text-right">Consola</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployments.map((deploy) => (
                      <tr key={deploy.id} className="border-b border-moon-border/40 hover:bg-moon-card/30 transition-colors">
                        <td className="py-4">
                          <p className="font-bold text-white max-w-xs truncate">{deploy.repoUrl.replace('https://github.com/', '')}</p>
                          <span className="text-[10px] text-moon-text/40 flex items-center gap-1 mt-0.5">
                            <GitBranch size={10} /> {deploy.branch}
                          </span>
                        </td>
                        <td className="py-4 uppercase text-moon-text/75">{deploy.projectType}</td>
                        <td className="py-4 text-moon-text/50">
                          {new Date(deploy.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-4">
                          <StatusBadge status={deploy.status} />
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleViewLogs(deploy.id)}
                            className="px-3 py-1.5 bg-moon-card hover:bg-moon-border border border-moon-border hover:border-moon-accent/40 text-white rounded font-bold transition-all-custom"
                          >
                            Ver logs
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column (EnvVars manager) */}
        <div>
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-6">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Key size={18} className="text-moon-accent" />
              <span>Variables de Entorno (.env)</span>
            </h3>

            {/* Form to add environment variable */}
            <form onSubmit={handleAddEnvVar} className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-moon-text/60 uppercase">Nombre de Variable (Key)</label>
                <input
                  type="text"
                  required
                  placeholder="EJ: DATABASE_URL"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3 py-2 bg-moon-card border border-moon-border rounded-lg text-white placeholder-moon-text/20 focus:outline-none focus:border-moon-accent font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-moon-text/60 uppercase">Valor (Value)</label>
                <input
                  type="text"
                  placeholder="Valor secreto"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-moon-card border border-moon-border rounded-lg text-white placeholder-moon-text/20 focus:outline-none focus:border-moon-accent"
                />
              </div>
              <button
                type="submit"
                disabled={envLoading || !newKey}
                className="w-full py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all-custom flex items-center justify-center gap-1.5 uppercase font-mono tracking-wider"
              >
                {envLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={14} />
                    <span>Guardar Variable</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-moon-border/40 space-y-3">
              <span className="text-[10px] font-bold text-moon-text/50 uppercase tracking-wider block font-mono">
                Variables Activas ({envVars.length})
              </span>
              
              {envVars.length === 0 ? (
                <p className="text-xs text-moon-text/40 italic font-mono p-4 border border-dashed border-moon-border rounded-lg bg-moon-card/30 text-center">
                  Sin variables registradas.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {envVars.map((v) => {
                    const isVisible = showValues[v.id]
                    return (
                      <div key={v.id} className="p-3 bg-moon-card border border-moon-border rounded-lg font-mono text-xs flex items-center justify-between gap-3 group">
                        <div className="overflow-hidden space-y-1">
                          <p className="font-bold text-white truncate">{v.key}</p>
                          <p className="text-[10px] text-emerald-400 select-all truncate">
                            {isVisible ? v.value : '••••••••••••'}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleShowValue(v.id)}
                            className="p-1.5 hover:bg-moon-border hover:text-white rounded transition-colors text-moon-text/60"
                            title={isVisible ? 'Ocultar' : 'Mostrar'}
                          >
                            {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            onClick={() => handleCopy(v.value, v.id)}
                            className="p-1.5 hover:bg-moon-border hover:text-white rounded transition-colors text-moon-text/60"
                            title="Copiar valor"
                          >
                            {copiedKey === v.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <button
                            onClick={() => handleDeleteEnvVar(v.id)}
                            className="p-1.5 hover:bg-red-950/20 hover:text-red-400 rounded transition-colors text-rose-500/80"
                            title="Eliminar variable"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* SSE logs real-time terminal modal */}
      {activeDeploymentId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-4xl h-[80vh] bg-[#09090e] border border-moon-border rounded-xl overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            
            {/* Console Header */}
            <div className="p-4 bg-moon-surface border-b border-moon-border flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5 font-mono">
                <Terminal size={18} className="text-emerald-400 animate-pulse" />
                <div>
                  <h3 className="text-xs font-bold text-white">Consola de Compilación e Instalación</h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-moon-text/50">
                    <span>ID: {activeDeploymentId.slice(0, 8)}...</span>
                    {activeStatus && (
                      <>
                        <span>|</span>
                        <StatusBadge status={activeStatus} />
                      </>
                    )}
                    {activeProjType && (
                      <>
                        <span>|</span>
                        <span className="uppercase text-moon-accent font-semibold">{activeProjType}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseLogs}
                className="p-2 hover:bg-moon-border text-moon-text/50 hover:text-white rounded-lg transition-all-custom"
                title="Cerrar Consola"
              >
                <X size={18} />
              </button>
            </div>

            {/* Console Screen */}
            <div className="flex-1 p-6 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 bg-black select-text selection:bg-emerald-500/20">
              <pre className="whitespace-pre-wrap font-mono">{logs}</pre>
              <div ref={terminalEndRef} />
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
