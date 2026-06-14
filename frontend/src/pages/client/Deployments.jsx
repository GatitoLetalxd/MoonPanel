import React, { useState, useEffect, useRef } from 'react'
import { Server, GitBranch, Rocket, Plus, Trash2, Copy, Check, Eye, EyeOff, Terminal, X, AlertCircle, Play, Key, ChevronDown, ChevronUp, BookOpen, Database, Upload, Lightbulb } from 'lucide-react'
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
  const [showModeModal, setShowModeModal] = useState(false)
  const [modeChangeLoading, setModeChangeLoading] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Database fields
  const [dbLoading, setDbLoading] = useState(false)
  const [sqlText, setSqlText] = useState('')
  const [sqlLoading, setSqlLoading] = useState(false)
  const [sqlOutput, setSqlOutput] = useState('')
  const [showDbPassword, setShowDbPassword] = useState(false)

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

  const handleActivateAutoDeploy = async () => {
    setModeChangeLoading(true)
    try {
      const res = await api.patch('/api/client/instance/mode', { mode: 'AUTO_DEPLOY' })
      setInstance(res.data.instance)
      setShowModeModal(false)
      window.location.reload()
    } catch (err) {
      alert(`Error al activar el despliegue automático: ${err.response?.data?.error || err.message}`)
    } finally {
      setModeChangeLoading(false)
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

  // Database operations
  const handleInstallDatabase = async (type) => {
    const confirmInstall = confirm(`¿Estás seguro de que deseas instalar ${type === 'POSTGRES' ? 'PostgreSQL' : 'MySQL'}? Esto recreará el contenedor y tu aplicación en ejecución se detendrá. Tus archivos no se borrarán, pero deberás redesplegar la aplicación.`);
    if (!confirmInstall) return;

    setDbLoading(true)
    try {
      const response = await api.post('/api/client/instance/database', { database: type })
      setInstance(response.data.instance)
      alert(response.data.message)
      window.location.reload()
    } catch (err) {
      alert(`Error al instalar base de datos: ${err.response?.data?.error || err.message}`)
    } finally {
      setDbLoading(false)
    }
  }

  const handleExecuteSql = async (e) => {
    e.preventDefault()
    if (!sqlText.trim()) return
    setSqlLoading(true)
    setSqlOutput('Ejecutando script SQL en la base de datos...')
    try {
      const response = await api.post('/api/client/instance/database/execute-sql', { sql: sqlText })
      setSqlOutput(response.data.output || 'Script ejecutado exitosamente con código de retorno 0.')
    } catch (err) {
      setSqlOutput(err.response?.data?.output || err.response?.data?.error || err.message)
    } finally {
      setSqlLoading(false)
    }
  }

  const handleSqlFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setSqlText(event.target.result)
    }
    reader.readAsText(file)
    // reset input
    e.target.value = ''
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

  if (instance.status === 'PENDING' || instance.status === 'CREATING') {
    return (
      <div className="flex-1 p-8 bg-moon-bg min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-moon-surface border border-moon-border p-8 rounded-xl shadow-xl space-y-4">
          <div className="w-12 h-12 bg-moon-accent/10 text-moon-accent rounded-full border border-moon-border flex items-center justify-center mx-auto">
            <Server size={20} />
          </div>
          <h3 className="font-bold text-white text-lg">Instancia Reservada</h3>
          <p className="text-xs text-moon-text/60 leading-relaxed font-mono">
            Tu servidor está reservado y en espera de activación.
            <br />
            Para poder configurar bases de datos, variables de entorno y realizar despliegues automáticos, primero activa la instancia en la pestaña <span className="text-white font-bold">Mi Instancia</span>.
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
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowModeModal(true)}
              className="px-6 py-3 bg-moon-accent hover:bg-moon-hover text-white font-bold rounded-lg shadow-lg shadow-moon-accent/25 transition-all-custom text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-1.5"
            >
              <Rocket size={14} />
              <span>Habilitar Modo Despliegue Automático</span>
            </button>
          </div>
        </div>

        {/* Mode Change Confirmation Modal */}
        {showModeModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-2xl animate-scale-up">
              
              {/* Header */}
              <div className="p-6 bg-moon-accent/10 border-b border-moon-border flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-moon-accent/20 text-moon-accent flex items-center justify-center shrink-0">
                  <Rocket size={22} className="animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white tracking-wide">Activar Despliegue Automático</h3>
                  <p className="text-xs text-moon-text/50 font-mono mt-1">
                    Instancia: <span className="font-bold">{instance.subdomain}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowModeModal(false)}
                  className="text-moon-text/40 hover:text-white transition-all-custom"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Warning Content */}
              <div className="p-6 space-y-4">
                <p className="font-mono text-xs leading-relaxed text-slate-300">
                  ¿Deseas activar el Modo Despliegue Automático para este servidor ahora?
                </p>
                <div className="p-3 bg-moon-card border border-moon-border/60 rounded text-[11px] text-moon-text/60 leading-relaxed font-mono">
                  * Esto te permitirá importar directamente repositorios públicos de GitHub y configurar variables de entorno para tu proyecto.
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModeModal(false)}
                  className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={modeChangeLoading}
                  onClick={handleActivateAutoDeploy}
                  className="px-4 py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white rounded-lg text-sm font-semibold shadow-lg shadow-moon-accent/20 transition-all-custom flex items-center gap-1.5"
                >
                  {modeChangeLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Rocket size={14} />
                      <span>Habilitar ahora</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen relative">
      
      {/* Title */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Flujo de Despliegue y Base de Datos</h2>
          <p className="text-sm text-moon-text/50 font-mono mt-0.5">
            Sigue los pasos secuenciales para aprovisionar tu base de datos, inyectar variables de entorno y desplegar tu código.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (Step 1: Database & Step 2: EnvVars) */}
        <div className="lg:col-span-1 space-y-8 order-1">
          
          {/* Database card (Paso 1) */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-6">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Database size={18} className="text-moon-accent" />
              <span>Paso 1: Gestión de Base de Datos</span>
            </h3>

            {dbLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <span className="w-8 h-8 border-3 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
                <span className="text-xs font-mono text-moon-text/60 text-center">Configurando base de datos e iniciando servicios...</span>
              </div>
            ) : instance.database === 'NONE' ? (
              <div className="space-y-4">
                <div className="p-4 bg-moon-card rounded-lg border border-moon-border/60 text-xs font-mono text-moon-text/60 leading-relaxed">
                  <p className="font-bold text-white mb-1">Inicializa tu base de datos</p>
                  Habilita un motor de base de datos (PostgreSQL o MySQL) que correrá directamente dentro de tu contenedor aislado.
                  <span className="text-amber-400 font-bold block mt-2">Importante:</span> Al instalar un motor se recreará el contenedor. Tus archivos de código no se borrarán, pero deberás redesplegar la aplicación en el Paso 3.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInstallDatabase('POSTGRES')}
                    className="p-4 bg-moon-card border border-moon-border hover:border-moon-accent/40 rounded-lg flex flex-col items-center justify-center gap-2 hover:text-white transition-all-custom"
                  >
                    <Database size={24} className="text-blue-400" />
                    <span className="text-xs font-mono font-bold">PostgreSQL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInstallDatabase('MYSQL')}
                    className="p-4 bg-moon-card border border-moon-border hover:border-moon-accent/40 rounded-lg flex flex-col items-center justify-center gap-2 hover:text-white transition-all-custom"
                  >
                    <Database size={24} className="text-amber-400" />
                    <span className="text-xs font-mono font-bold">MySQL</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 font-mono text-xs">
                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[11px] text-emerald-400 leading-relaxed space-y-1.5">
                  <p className="font-bold text-white flex items-center gap-1.5"><Check size={14} className="text-emerald-400" /> Base de datos activa y en línea</p>
                  <p>Para conectar tu aplicación utiliza los siguientes hosts internos desde tu código:</p>
                  <p className="bg-black/60 p-2 rounded select-all text-white border border-moon-border/40 font-bold break-all">
                    {instance.database === 'POSTGRES' 
                      ? 'postgresql://postgres:CONTRASEÑA@127.0.0.1:5432/appdb' 
                      : 'mysql://root:CONTRASEÑA@127.0.0.1:3306/appdb'}
                  </p>
                  <p className="text-[10px] text-moon-text/50">
                    Sustituye <strong className="text-white">CONTRASEÑA</strong> por el valor cifrado abajo. Para conexiones externas, usa el host externo `moondev.online` y tu puerto asignado.
                  </p>
                </div>

                {/* DB Info */}
                <div className="bg-moon-card border border-moon-border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between border-b border-moon-border/40 pb-2">
                    <span className="text-moon-text/50">Motor:</span>
                    <span className="text-moon-accent font-bold">{instance.database}</span>
                  </div>
                  <div className="flex justify-between border-b border-moon-border/40 pb-2">
                    <span className="text-moon-text/50">Base de Datos:</span>
                    <span className="text-white font-semibold">appdb</span>
                  </div>
                  <div className="flex justify-between border-b border-moon-border/40 pb-2">
                    <span className="text-moon-text/50">Usuario:</span>
                    <span className="text-white font-semibold">{instance.database === 'POSTGRES' ? 'postgres' : 'root'}</span>
                  </div>
                  <div className="flex justify-between border-b border-moon-border/40 pb-2">
                    <span className="text-moon-text/50">Puerto Externo:</span>
                    <span className="text-white font-semibold">{instance.dbPort}</span>
                  </div>
                  <div className="flex justify-between border-b border-moon-border/40 pb-2">
                    <span className="text-moon-text/50">Host Externo:</span>
                    <span className="text-white font-semibold">moondev.online</span>
                  </div>
                  <div className="pt-1.5">
                    <span className="text-moon-text/50 block mb-1">Contraseña:</span>
                    <div className="flex items-center justify-between bg-moon-bg border border-moon-border px-3 py-2 rounded-lg">
                      <span className="text-white select-all font-bold tracking-wider break-all">
                        {showDbPassword ? instance.dbPassword : '••••••••••••'}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowDbPassword(!showDbPassword)}
                          className="p-1 hover:bg-moon-border rounded text-moon-text/60 hover:text-white"
                          title="Mostrar contraseña"
                        >
                          {showDbPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(instance.dbPassword, 'dbPassword')}
                          className="p-1 hover:bg-moon-border rounded text-moon-text/60 hover:text-white"
                          title="Copiar contraseña"
                        >
                          {copiedKey === 'dbPassword' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SQL execution interface */}
                <form onSubmit={handleExecuteSql} className="space-y-3 border-t border-moon-border/40 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-moon-text/60 uppercase">Ejecutar Script SQL</label>
                    <label className="flex items-center gap-1 text-[10px] text-moon-accent hover:text-moon-hover cursor-pointer font-bold">
                      <Upload size={12} />
                      <span>Cargar .sql</span>
                      <input
                        type="file"
                        accept=".sql"
                        onChange={handleSqlFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <textarea
                    rows={5}
                    value={sqlText}
                    onChange={(e) => setSqlText(e.target.value)}
                    placeholder={`-- Ejemplo SQL:\nCREATE TABLE usuarios (\n  id SERIAL PRIMARY KEY,\n  nombre VARCHAR(50)\n);`}
                    className="w-full px-3 py-2 bg-moon-card border border-moon-border rounded-lg text-white placeholder-moon-text/25 focus:outline-none focus:border-moon-accent font-mono text-xs resize-y"
                  />
                  <button
                    type="submit"
                    disabled={sqlLoading || !sqlText.trim()}
                    className="w-full py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all-custom flex items-center justify-center gap-1.5 uppercase font-mono tracking-wider"
                  >
                    {sqlLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Play size={12} />
                        <span>Ejecutar SQL</span>
                      </>
                    )}
                  </button>
                </form>

                {/* SQL output console */}
                {sqlOutput && (
                  <div className="space-y-1.5 border-t border-moon-border/40 pt-4">
                    <span className="text-[10px] font-bold text-moon-text/60 uppercase">Resultado de Ejecución</span>
                    <pre className="w-full p-3 bg-black border border-moon-border/80 rounded-lg text-[10px] text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-48">
                      {sqlOutput}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EnvVars manager (Paso 2) */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-6">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Key size={18} className="text-moon-accent" />
              <span>Paso 2: Variables de Entorno (.env)</span>
            </h3>

            <div className="p-4 bg-moon-card rounded-lg border border-moon-border/60 text-xs font-mono text-moon-text/60 leading-relaxed">
              <p className="font-bold text-white mb-1">Inyecta parámetros a tu servidor</p>
              Registra las credenciales de conexión obtenidas del Paso 1 (como <code className="text-white">DB_PASSWORD</code>, <code className="text-white">DB_HOST</code>) antes del despliegue.
              <span className="text-moon-accent font-bold block mt-1.5">Tip:</span> Al guardar o borrar variables se actualizará tu archivo <code className="text-white">.env</code> de manera segura, pero tendrás que redesplegar en el Paso 3 para aplicar los cambios.
            </div>

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
                  className="w-full px-3 py-2 bg-moon-card border border-moon-border rounded-lg text-white placeholder-moon-text/20 focus:outline-none focus:border-moon-accent font-bold uppercase"
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
                            type="button"
                            onClick={() => toggleShowValue(v.id)}
                            className="p-1.5 hover:bg-moon-border hover:text-white rounded transition-colors text-moon-text/60"
                            title={isVisible ? 'Ocultar' : 'Mostrar'}
                          >
                            {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(v.value, v.id)}
                            className="p-1.5 hover:bg-moon-border hover:text-white rounded transition-colors text-moon-text/60"
                            title="Copiar valor"
                          >
                            {copiedKey === v.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <button
                            type="button"
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

        {/* Right column (Step 3: Deploy configuration & History) */}
        <div className="lg:col-span-2 space-y-8 order-2">
          
          {/* GitHub configuration form (Paso 3) */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-6">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Rocket size={18} className="text-moon-accent" />
              <span>Paso 3: Desplegar Nuevo Repositorio</span>
            </h3>

            <div className="p-4 bg-moon-card rounded-lg border border-moon-border/60 text-xs font-mono text-moon-text/60 leading-relaxed">
              <p className="font-bold text-white mb-1">Compila y ejecuta tu código fuente</p>
              Ingresa el enlace de tu repositorio de GitHub público y su rama de producción. MoonPanel clonará el código de forma limpia, aplicará las variables del Paso 2, configurará los servidores proxy web y arrancará tus servicios con PM2.
            </div>

            {/* Guía de Estructura de Repositorios (Collapsible) */}
            <div className="border border-moon-border/60 rounded-lg bg-moon-card/45 overflow-hidden transition-all-custom">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full px-4 py-3 flex items-center justify-between font-mono text-xs text-white hover:bg-moon-border/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-moon-accent" />
                  <span className="font-bold">Guía de Estructura y Compatibilidad</span>
                </div>
                {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showGuide && (
                <div className="p-4 border-t border-moon-border/40 font-mono text-xs space-y-4 leading-relaxed">
                  
                  {/* Grid de tecnologías */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* Card: Frontend */}
                    <div className="p-3 bg-moon-surface border border-moon-border/40 rounded-lg space-y-1.5">
                      <span className="font-bold text-white flex items-center gap-1">Frontend (React, Vite, Astro, etc.)</span>
                      <p className="text-[11px] text-moon-text/70">
                        • Requiere <code className="text-moon-accent font-semibold">package.json</code> con script <code className="text-white">"build"</code>.<br />
                        • Debe compilar en carpeta <code className="text-white">dist</code> o <code className="text-white">build</code> en la raíz.
                      </p>
                    </div>

                    {/* Card: Node.js */}
                    <div className="p-3 bg-moon-surface border border-moon-border/40 rounded-lg space-y-1.5">
                      <span className="font-bold text-white flex items-center gap-1">Node.js Backend (Express, Nest, etc.)</span>
                      <p className="text-[11px] text-moon-text/70">
                        • Requiere <code className="text-moon-accent font-semibold">package.json</code> en la raíz.<br />
                        • Debe escuchar en <code className="text-white">process.env.PORT</code> (inyectado como 5000).<br />
                        • Se inicia con <code className="text-white">npm start</code> o archivo <code className="text-white">index/app/server.js</code>.
                      </p>
                    </div>

                    {/* Card: Python */}
                    <div className="p-3 bg-moon-surface border border-moon-border/40 rounded-lg space-y-1.5">
                      <span className="font-bold text-white flex items-center gap-1">Python (FastAPI, Flask, Django)</span>
                      <p className="text-[11px] text-moon-text/70">
                        • Requiere <code className="text-moon-accent font-semibold">requirements.txt</code> en la raíz.<br />
                        • Debe escuchar en el puerto <code className="text-white">5000</code>.<br />
                        • Inicia vía <code className="text-white">manage.py</code>, <code className="text-white">main.py</code> o <code className="text-white">app.py</code>.
                      </p>
                    </div>

                    {/* Card: Estático */}
                    <div className="p-3 bg-moon-surface border border-moon-border/40 rounded-lg space-y-1.5">
                      <span className="font-bold text-white flex items-center gap-1">HTML / CSS / JS Estático</span>
                      <p className="text-[11px] text-moon-text/70">
                        • Solo requiere un archivo <code className="text-moon-accent font-semibold">index.html</code> en la raíz.<br />
                        • No necesita dependencias ni compilación.
                      </p>
                    </div>

                  </div>

                  {/* Advertencias Generales */}
                  <div className="pt-3 border-t border-moon-border/40 space-y-2.5 text-[11px] text-amber-400">
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5"><Lightbulb size={12} className="text-amber-400" /></span>
                      <span className="text-moon-text/85"><strong className="text-white">Regla de oro:</strong> Todos los archivos de arranque deben estar en la raíz de tu repositorio (o especificar subdirectorio de forma manual).</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5"><AlertCircle size={12} className="text-amber-400" /></span>
                      <span>Tu aplicación debe correr en el puerto interno 3000 (para frontend) o escuchar en el puerto 5000 (para backend).</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5"><AlertCircle size={12} className="text-amber-400" /></span>
                      <span>Únicamente se soportan repositorios de GitHub <strong>públicos</strong>.</span>
                    </p>
                  </div>

                </div>
              )}
            </div>

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

          {/* Deployment History list (Paso 4) */}
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
                      <th className="pb-3 font-semibold pr-2">Proyecto / Rama</th>
                      <th className="pb-3 font-semibold px-2">Tipo</th>
                      <th className="pb-3 font-semibold px-2">Fecha</th>
                      <th className="pb-3 font-semibold px-2">Estado</th>
                      <th className="pb-3 font-semibold text-right pl-2">Consola</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployments.map((deploy) => (
                      <tr key={deploy.id} className="border-b border-moon-border/40 hover:bg-moon-card/30 transition-colors">
                        <td className="py-4 pr-2">
                          <p className="font-bold text-white max-w-[150px] sm:max-w-xs truncate">{deploy.repoUrl.replace('https://github.com/', '')}</p>
                          <span className="text-[10px] text-moon-text/40 flex items-center gap-1 mt-0.5">
                            <GitBranch size={10} /> {deploy.branch}
                          </span>
                        </td>
                        <td className="py-4 px-2 uppercase text-moon-text/75">{deploy.projectType}</td>
                        <td className="py-4 px-2 text-moon-text/50 whitespace-nowrap">
                          {new Date(deploy.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-4 px-2">
                          <StatusBadge status={deploy.status} />
                        </td>
                        <td className="py-4 text-right pl-2">
                          <button
                            type="button"
                            onClick={() => handleViewLogs(deploy.id)}
                            className="px-3 py-1.5 bg-moon-card hover:bg-moon-border border border-moon-border hover:border-moon-accent/40 text-white rounded font-bold transition-all-custom whitespace-nowrap"
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
