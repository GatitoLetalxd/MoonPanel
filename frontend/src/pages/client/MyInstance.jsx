import React, { useState, useEffect } from 'react'
import { Server, Play, Square, RotateCcw, Copy, Check, Eye, EyeOff, Terminal, ExternalLink, AlertCircle, Trash2, X, ShieldAlert } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import ResourceBar from '../../components/ResourceBar'
import api from '../../api/axios'

export default function MyInstance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showDbPassword, setShowDbPassword] = useState(false)
  const [copiedField, setCopiedField] = useState('')
  const [stats, setStats] = useState({ cpu: '0.00', ramUsed: 0, ramLimit: 0 })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmSubdomain, setConfirmSubdomain] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)
  const [pendingMode, setPendingMode] = useState('')
  const [modeLoading, setModeLoading] = useState(false)

  const loadData = async () => {
    try {
      const response = await api.get('/api/client/instance')
      setData(response.data)
      if (response.data.instance) {
        setStats(prev => ({
          ...prev,
          ramLimit: response.data.instance.ramLimit
        }))
      }
    } catch (error) {
      console.error('[MY INSTANCE ERROR] Error al cargar:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carga inicial
  useEffect(() => {
    loadData()
  }, [])

  // Polling de estadísticas si el contenedor está activo
  useEffect(() => {
    if (!data?.instance || data.instance.status !== 'RUNNING') return

    let active = true
    const interval = setInterval(async () => {
      try {
        const statsRes = await api.get('/api/client/instance/stats')
        if (active) {
          setStats(statsRes.data)
        }
      } catch (err) {
        console.error('Error al obtener estadísticas:', err)
      }
    }, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [data?.instance?.status])

  const handleAction = async (action) => {
    setActionLoading(true)
    try {
      const res = await api.post(`/api/client/instance/${action}`)
      setData(prev => ({
        ...prev,
        instance: { ...prev.instance, status: res.data.status }
      }))
      
      // Limpiar stats si se apaga
      if (action === 'stop') {
        setStats({ cpu: '0.00', ramUsed: 0, ramLimit: data?.instance?.ramLimit || 512 })
      }
    } catch (error) {
      alert(`Error al ejecutar acción: ${error.response?.data?.error || error.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleLaunchInstance = async () => {
    setActionLoading(true)
    setData(prev => ({
      ...prev,
      instance: { ...prev.instance, status: 'CREATING' }
    }))
    try {
      const res = await api.post('/api/client/instance/launch')
      setData(prev => ({
        ...prev,
        instance: res.data.instance
      }))
      await loadData()
    } catch (error) {
      alert(`Error al lanzar la instancia: ${error.response?.data?.error || error.message}`)
      setData(prev => ({
        ...prev,
        instance: { ...prev.instance, status: 'PENDING' }
      }))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteInstance = async () => {
    if (confirmSubdomain.toLowerCase() !== data?.instance?.subdomain?.toLowerCase()) return
    setDeleteLoading(true)
    try {
      await api.delete('/api/client/instance')
      alert('Instancia eliminada correctamente. Tu entorno ha sido restablecido al estado PENDING.')
      setShowDeleteModal(false)
      window.location.reload()
    } catch (err) {
      alert(`Error al eliminar la instancia: ${err.response?.data?.error || err.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleConfirmModeChange = async () => {
    if (!pendingMode) return
    setModeLoading(true)
    try {
      const res = await api.patch('/api/client/instance/mode', { mode: pendingMode })
      setData(prev => ({ ...prev, instance: res.data.instance }))
      setShowModeModal(false)
      alert('Modo actualizado con éxito.')
    } catch (err) {
      alert(`Error al actualizar el modo: ${err.response?.data?.error || err.message}`)
    } finally {
      setModeLoading(false)
    }
  }

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando Instancia...</span>
        </div>
      </div>
    )
  }

  if (!data?.instance) {
    return (
      <div className="flex-1 p-8 bg-moon-bg min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-moon-surface border border-moon-border p-8 rounded-xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Server size={20} />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">Sin Entorno Activo</h3>
          <p className="text-xs text-moon-text/50 font-mono">
            Aún no tienes una instancia aprovisionada. Comunícate con GatitoLetal para que te asigne puertos y active tu entorno.
          </p>
        </div>
      </div>
    )
  }

  const { instance, sshInfo } = data

  // Pantalla de lanzamiento si está PENDING o CREATING
  if (instance.status === 'PENDING' || instance.status === 'CREATING') {
    return (
      <div className="flex-1 p-8 bg-moon-bg min-h-screen flex items-center justify-center">
        <div className="text-center max-w-lg bg-moon-surface border border-moon-border p-8 rounded-xl shadow-xl">
          <div className="w-16 h-16 bg-moon-accent/15 text-moon-accent rounded-full border border-moon-accent/20 flex items-center justify-center mx-auto mb-6">
            <Server size={32} className={instance.status === 'CREATING' ? 'animate-pulse' : ''} />
          </div>
          <h3 className="font-bold text-white text-xl mb-3">
            {instance.status === 'CREATING' ? 'Inicializando Instancia...' : 'Tu Instancia está Pendiente'}
          </h3>
          <p className="text-sm text-moon-text/60 font-mono mb-6 leading-relaxed">
            {instance.status === 'CREATING' 
              ? 'Estamos levantando tu contenedor y configurando SSH, bases de datos y red. Esto tomará unos segundos.'
              : 'Tu espacio en MoonVPS ha sido registrado. Aún no se ha creado tu contenedor físico. Pulsa el botón inferior para lanzar tu entorno al instante.'
            }
          </p>
          
          <button
            onClick={handleLaunchInstance}
            disabled={instance.status === 'CREATING' || actionLoading}
            className="px-6 py-3 bg-moon-accent hover:bg-moon-hover text-white font-bold rounded-lg shadow-lg shadow-moon-accent/25 transition-all-custom flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
          >
            {(instance.status === 'CREATING' || actionLoading) ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creando Contenedor...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Lanzar mi instancia</span>
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  const fullDomain = `${instance.subdomain}.moondev.online`

  return (
    <div className="flex-1 p-8 bg-moon-bg min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-wide">Mi Servidor Web</h2>
            <StatusBadge status={instance.status} />
          </div>
          <p className="text-sm text-moon-text/50 font-mono">Administra tu instancia y despliega tus proyectos</p>
        </div>
        
        {/* Container action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading || instance.status === 'RUNNING'}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-semibold tracking-wider font-mono uppercase transition-all-custom"
          >
            <Play size={14} />
            <span>Start</span>
          </button>
          <button
            onClick={() => handleAction('stop')}
            disabled={actionLoading || instance.status === 'STOPPED'}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-semibold tracking-wider font-mono uppercase transition-all-custom"
          >
            <Square size={14} />
            <span>Stop</span>
          </button>
          <button
            onClick={() => handleAction('restart')}
            disabled={actionLoading}
            className="p-2.5 bg-moon-surface hover:bg-moon-border text-moon-text hover:text-white border border-moon-border rounded-lg transition-all-custom"
            title="Reiniciar Servidor"
          >
            <RotateCcw size={16} className={actionLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Domain & Resource Usage */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Domain card */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-4">Dirección Web del Proyecto</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-moon-card border border-moon-border p-4 rounded-lg font-mono text-sm">
              <div>
                <span className="text-moon-text/40 block text-xs uppercase tracking-wider mb-1">Subdominio asignado:</span>
                <a 
                  href={`http://${fullDomain}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-moon-accent hover:underline font-bold text-base flex items-center gap-1.5"
                >
                  {fullDomain}
                  <ExternalLink size={14} />
                </a>
              </div>
              <button
                onClick={() => handleCopy(`http://${fullDomain}`, 'domain')}
                className="self-start sm:self-center px-4 py-2.5 bg-moon-border hover:bg-moon-border/80 border border-moon-border hover:border-moon-text/20 text-white rounded-lg flex items-center justify-center gap-2 transition-all-custom text-xs"
              >
                {copiedField === 'domain' ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-moon-text/40 mt-3 font-mono leading-relaxed">
              * El tráfico HTTP en el puerto 80 del subdominio se redirige automáticamente al puerto 3000 interno de tu instancia Docker.
            </p>
          </div>

          {/* Real-time resources */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-6">
            <h3 className="font-bold text-white text-base">Consumo en Tiempo Real (Telemetría)</h3>
            
            {instance.status !== 'RUNNING' ? (
              <div className="py-8 border border-dashed border-moon-border rounded-lg bg-moon-card/30 text-center">
                <p className="text-xs text-moon-text/40 font-mono">
                  Enciende tu servidor para habilitar el reporte de consumo de CPU y memoria.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* RAM Limit usage */}
                <ResourceBar 
                  label="Uso de RAM" 
                  value={stats.ramUsed} 
                  max={stats.ramLimit} 
                  unit="MB" 
                />

                {/* Disk Limit usage */}
                <ResourceBar 
                  label="Uso de Disco" 
                  value={stats.diskUsed || 0} 
                  max={stats.diskLimit || instance.diskLimit} 
                  unit="MB" 
                />

                {/* Disk Alert warning */}
                {(stats.diskUsed > (stats.diskLimit || instance.diskLimit)) && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>¡Alerta! Has excedido tu almacenamiento límite ({instance.diskLimit} MB). Libera espacio.</span>
                  </div>
                )}

                {/* CPU usage estimation */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-moon-text/75">Carga de CPU</span>
                    <span className="text-white font-mono font-semibold">
                      {stats.cpu}% / {instance.cpuLimit} Cores
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-moon-card border border-moon-border/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 ease-out shadow-sm bg-emerald-500 shadow-emerald-500/20"
                      style={{ width: `${Math.min(Math.round((parseFloat(stats.cpu) / (instance.cpuLimit * 100)) * 100), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-moon-border/40 font-mono text-xs">
                  <div className="bg-moon-card/50 p-3 rounded-lg border border-moon-border/50 text-center">
                    <p className="text-moon-text/40 mb-1">Cores Máximos</p>
                    <p className="text-white font-bold text-base">{instance.cpuLimit}</p>
                  </div>
                  <div className="bg-moon-card/50 p-3 rounded-lg border border-moon-border/50 text-center">
                    <p className="text-moon-text/40 mb-1">Almacenamiento Máx.</p>
                    <p className="text-white font-bold text-base">{instance.diskLimit} MB</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: SSH Access & Database Card */}
        <div className="space-y-6">
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Terminal size={18} className="text-moon-accent" />
              <span>Acceso SSH del Contenedor</span>
            </h3>

            <div className="bg-moon-card border border-moon-border rounded-lg p-5 font-mono text-xs text-moon-text/85 space-y-4">
              
              <div className="space-y-1">
                <span className="text-moon-text/40 uppercase text-[10px] tracking-wider font-semibold">Comando SSH</span>
                <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                  <span className="text-emerald-400 select-all font-semibold break-all">
                    ssh root@{sshInfo?.host} -p {sshInfo?.sshPort}
                  </span>
                  <button
                    onClick={() => handleCopy(`ssh root@${sshInfo?.host} -p ${sshInfo?.sshPort}`, 'sshcmd')}
                    className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded shrink-0 ml-2"
                    title="Copiar comando"
                  >
                    {copiedField === 'sshcmd' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-moon-text/40 uppercase text-[10px] tracking-wider font-semibold">Contraseña Temporal</span>
                <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                  <span className="text-white font-bold select-all tracking-wider">
                    {showPassword ? sshInfo?.password : '••••••••••••'}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => handleCopy(sshInfo?.password, 'password')}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                      title="Copiar contraseña"
                    >
                      {copiedField === 'password' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-moon-bg border border-moon-border/40 rounded text-[10px] text-moon-text/60 leading-relaxed">
                Recomendamos inyectar tu llave pública SSH en la sección <span className="text-moon-accent font-semibold">Llaves SSH</span> para iniciar sesión de forma segura sin password.
              </div>

              {instance.mode === 'AUTO_DEPLOY' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px] leading-relaxed flex gap-1.5 items-start">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>Modificar archivos manualmente vía SSH puede entrar en conflicto con futuros despliegues automáticos desde GitHub.</span>
                </div>
              )}
            </div>
          </div>

          {/* Database Info Card */}
          {instance.database !== 'NONE' && (
            <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Server size={18} className="text-moon-accent" />
                <span>Base de Datos Preinstalada</span>
              </h3>

              <div className="bg-moon-card border border-moon-border rounded-lg p-5 font-mono text-xs text-moon-text/85 space-y-4">
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Motor:</span>
                  <span className="text-white font-bold">{instance.database}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Host:</span>
                  <span className="text-white select-all">{sshInfo?.host}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Puerto Externo:</span>
                  <span className="text-white font-bold select-all">{instance.dbPort}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Usuario:</span>
                  <span className="text-white select-all">{instance.database === 'POSTGRES' ? 'postgres' : 'root'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Database:</span>
                  <span className="text-white select-all font-bold">appdb</span>
                </div>
                
                <div className="space-y-1 pt-1">
                  <span className="text-moon-text/50 block mb-1">Contraseña:</span>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                    <span className="text-white font-bold select-all tracking-wider">
                      {showDbPassword ? instance.dbPassword : '••••••••••••'}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setShowDbPassword(!showDbPassword)}
                        className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                      >
                        {showDbPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => handleCopy(instance.dbPassword, 'dbpassword')}
                        className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                        title="Copiar contraseña de BD"
                      >
                        {copiedField === 'dbpassword' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connection String */}
                <div className="space-y-1">
                  <span className="text-moon-text/50 block mb-1 font-semibold">Connection String:</span>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded text-[10px]">
                    <span className="text-white select-all break-all leading-relaxed">
                      {instance.database === 'POSTGRES' 
                        ? `postgresql://postgres:${instance.dbPassword}@${sshInfo?.host}:${instance.dbPort}/appdb`
                        : `mysql://root:${instance.dbPassword}@${sshInfo?.host}:${instance.dbPort}/appdb`
                      }
                    </span>
                    <button
                      onClick={() => handleCopy(
                        instance.database === 'POSTGRES' 
                          ? `postgresql://postgres:${instance.dbPassword}@${sshInfo?.host}:${instance.dbPort}/appdb`
                          : `mysql://root:${instance.dbPassword}@${sshInfo?.host}:${instance.dbPort}/appdb`,
                        'connstring'
                      )}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded shrink-0 ml-2"
                      title="Copiar connection string"
                    >
                      {copiedField === 'connstring' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selector Card */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <RotateCcw size={16} className="text-moon-accent" />
              <span>Modo de Despliegue</span>
            </h3>
            <div className="space-y-3 font-mono text-xs">
              <p className="text-moon-text/60 leading-relaxed text-[11px]">
                Elige cómo quieres gestionar tu servidor:
              </p>
              <select
                value={instance.mode}
                onChange={(e) => {
                  setPendingMode(e.target.value)
                  setShowModeModal(true)
                }}
                className="w-full px-3 py-2 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white rounded-lg focus:outline-none font-bold"
              >
                <option value="SSH">SSH Manual (Terminal)</option>
                <option value="AUTO_DEPLOY">Despliegue Automático (GitHub)</option>
              </select>
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-moon-surface border border-rose-500/20 p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>Zona de Peligro</span>
            </h3>
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-5 font-mono text-xs text-moon-text/85 space-y-4">
              <p className="text-[10px] text-rose-400 leading-relaxed font-semibold">
                ⚠️ ATENCIÓN: Al eliminar tu instancia se detendrá y borrará permanentemente tu contenedor Docker, base de datos y archivos. Los datos no se podrán recuperar.
              </p>
              <button
                onClick={() => {
                  setConfirmSubdomain('')
                  setShowDeleteModal(true)
                }}
                disabled={actionLoading}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded-lg transition-all-custom flex items-center justify-center gap-1.5 uppercase font-mono tracking-wider text-[11px]"
              >
                <Trash2 size={13} />
                <span>Eliminar Instancia</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-moon-surface border border-rose-500/20 rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Header */}
            <div className="p-6 bg-rose-500/10 border-b border-rose-500/20 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white tracking-wide">¿Eliminar Instancia y Archivos?</h3>
                <p className="text-xs text-rose-400/80 font-mono mt-1">
                  Instancia: <span className="font-bold">{instance.subdomain}</span>
                </p>
              </div>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="text-moon-text/40 hover:text-white transition-all-custom"
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Content */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-rose-950/25 border border-rose-900/40 text-rose-300 text-xs rounded-lg space-y-1">
                <p className="font-semibold text-rose-200">¡ATENCIÓN ELIMINACIÓN DE DATOS!</p>
                <p className="leading-relaxed font-mono">
                  Esta acción detendrá y eliminará el contenedor físico, todas tus bases de datos, variables de entorno y archivos montados del host permanentemente. Esto no se puede deshacer.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Escribe el subdominio (<span className="font-mono text-white font-bold">{instance.subdomain}</span>) para confirmar destrucción:
                </label>
                <input
                  type="text"
                  required
                  value={confirmSubdomain}
                  onChange={(e) => setConfirmSubdomain(e.target.value)}
                  placeholder={instance.subdomain}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-rose-500 focus:outline-none text-white placeholder-moon-text/20 rounded-lg font-mono text-sm transition-all-custom"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteLoading || confirmSubdomain.toLowerCase() !== instance.subdomain.toLowerCase()}
                onClick={handleDeleteInstance}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-rose-600/20 transition-all-custom flex items-center gap-1.5"
              >
                {deleteLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Mode Change Confirmation Modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Header */}
            <div className="p-6 bg-moon-accent/10 border-b border-moon-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-moon-accent/20 text-moon-accent flex items-center justify-center shrink-0">
                <RotateCcw size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white tracking-wide">Cambiar Modo de Despliegue</h3>
                <p className="text-xs text-moon-text/50 font-mono mt-1">
                  Subdominio: <span className="font-bold">{instance.subdomain}</span>
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
                ¿Estás seguro de que deseas cambiar el modo de despliegue a <span className="text-white font-bold">{pendingMode === 'SSH' ? 'SSH Manual (Terminal)' : 'Despliegue Automático (GitHub)'}</span>?
              </p>
              {pendingMode === 'AUTO_DEPLOY' && (
                <div className="p-3 bg-moon-card border border-moon-border/60 rounded text-[11px] text-moon-text/60 leading-relaxed font-mono">
                  * Habilitar el despliegue automático te permitirá clonar proyectos de GitHub e inyectar variables de entorno.
                </div>
              )}
              {pendingMode === 'SSH' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[11px] leading-relaxed font-mono">
                  * Cambiar a SSH Manual desactivará el panel de despliegues automatizados de GitHub.
                </div>
              )}
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
                disabled={modeLoading}
                onClick={handleConfirmModeChange}
                className="px-4 py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white rounded-lg text-sm font-semibold shadow-lg shadow-moon-accent/20 transition-all-custom flex items-center gap-1.5"
              >
                {modeLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <RotateCcw size={16} />
                    <span>Confirmar Cambio</span>
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
