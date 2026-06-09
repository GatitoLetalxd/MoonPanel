import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { 
  ArrowLeft, Play, Square, RotateCcw, 
  Settings, Key, Eye, EyeOff, Copy, Check, 
  Trash2, Cpu, HardDrive, ShieldAlert, X,
  Activity, AlertCircle
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import ResourceBar from '../../components/ResourceBar'
import api from '../../api/axios'

export default function InstanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [instance, setInstance] = useState(null)
  const [sshInfo, setSshInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState('')

  // Edición de recursos
  const [ramLimit, setRamLimit] = useState(512)
  const [cpuLimit, setCpuLimit] = useState(0.5)
  const [diskLimit, setDiskLimit] = useState(2048)
  const [limitsLoading, setLimitsLoading] = useState(false)

  // SSH Keys
  const [sshKeys, setSshKeys] = useState([])
  const [sshKeysLoading, setSshKeysLoading] = useState(false)

  // Gráfica de stats
  const [chartData, setChartData] = useState([])
  const chartPointsRef = useRef([])
  const [stats, setStats] = useState({ cpu: '0.00', ramUsed: 0, ramLimit: 0, diskUsed: 0, diskLimit: 0 })

  // Modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmSubdomain, setConfirmSubdomain] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  // Cargar info de instancia
  const loadInstanceData = async () => {
    try {
      const instResponse = await api.get('/api/admin/instances')
      const targetInst = instResponse.data.find(i => i.id === id)
      
      if (!targetInst) {
        navigate('/admin/dashboard')
        return
      }

      setInstance(targetInst)
      setRamLimit(targetInst.ramLimit)
      setCpuLimit(targetInst.cpuLimit)
      setDiskLimit(targetInst.diskLimit)

      // Cargar llaves SSH del cliente (el backend las inyecta en authorized_keys, las listamos desde la BD por medio del usuario/instancia)
      if (targetInst.userId) {
        // En Express, el admin endpoints nos permite ver info detallada.
        // Las keys están asociadas a la instancia. Consultamos las keys del cliente usando el endpoint de admin:
        // Pero espera! En los endpoints de admin no declaramos explícitamente GET /api/admin/instances/:id/ssh-keys,
        // sin embargo, la relación Prisma devuelve las keys si hacemos include en el findUnique, o podemos listarlas.
        // Dado que Prisma las vincula a la instancia, modifiquemos las consultas para incluirlas o hagamos fetch.
        // Para facilidad, en adminController getInstances incluimos a user. Vamos a agregar la carga de keys desde el endpoint de cliente
        // o adaptarlo. En adminController no incluimos explicitamente sshKeys, vamos a verificar qué retorna.
        // Si no está, podemos consultar o incluir en el endpoint.
        // Como podemos obtener las keys haciendo una consulta, vamos a implementar un fetch directo de keys de esa instancia.
        // Pero espera, ¿el adminController getInstances incluye sshKeys? No lo incluía. Vamos a hacer que lo traiga o lo obtenga.
        // Como admin, podemos obtener los datos del cliente que incluye la instancia y sshKeys.
        // Vamos a hacer una llamada a /api/admin/clients para obtener las keys del usuario si es necesario.
        // O más fácil: agregamos las keys directamente al state desde el objeto instance que consultamos,
        // o hacemos un fetch. Vamos a obtenerlas de la consulta de clientes que sí incluye la instancia y sshKeys si las añadimos.
        // De hecho, en adminController getInstances podemos modificarlo o simplemente usar Prisma.
        // Vamos a simular que el endpoint retorna las keys si la relacion está, o las traemos de los detalles del cliente.
        // Para asegurar, podemos hacer una llamada para cargar las keys.
        // Vamos a consultar la base de datos o usar una simulación en el frontend si es necesario.
        // Pero como escribimos adminController.js, podemos ver qué incluimos. En adminController.js getInstances no incluimos sshKeys.
        // Modifiquemos adminController.js para que en getInstances se incluyan sshKeys.
        // Wait, yes! We can use replace_file_content or multi_replace_file_content to add `sshKeys: true` inside `getInstances`!
        // That is extremely easy. Let's do that right after.
        // Por ahora, asumamos que las llaves están en `instance.sshKeys`.
        if (targetInst.sshKeys) {
          setSshKeys(targetInst.sshKeys)
        }
      }

      // Cargar credenciales SSH
      const sshRes = await api.get(`/api/admin/instances/${id}/ssh-info`)
      setSshInfo(sshRes.data)

      // Carga inicial de estadísticas si está corriendo
      if (targetInst.status === 'RUNNING') {
        api.get(`/api/admin/instances/${id}/stats`).then(res => {
          setStats(res.data)
        }).catch(() => {})
      }
    } catch (error) {
      console.error('Error al cargar detalles de la instancia:', error)
    } finally {
      setLoading(false)
    }
  }

  // Polling de estadísticas
  useEffect(() => {
    loadInstanceData()

    let active = true
    const interval = setInterval(async () => {
      if (!instance || instance.status !== 'RUNNING' || !active) return
      
      try {
        const statsRes = await api.get(`/api/admin/instances/${id}/stats`)
        const statsData = statsRes.data
        if (active) {
          setStats(statsData)
        }
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

        const newPoint = {
          name: timeStr,
          cpu: parseFloat(statsData.cpu),
          ram: statsData.ramUsed,
          ramLimit: statsData.ramLimit
        }

        chartPointsRef.current = [...chartPointsRef.current, newPoint].slice(-10) // Mantener últimos 10 puntos
        setChartData([...chartPointsRef.current])
      } catch (err) {
        console.error('Error polling stats:', err)
      }
    }, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [id, instance?.status])

  // Controles de contenedor
  const handleContainerAction = async (action) => {
    setActionLoading(true)
    try {
      const res = await api.post(`/api/admin/instances/${id}/${action}`)
      setInstance(prev => ({ ...prev, status: res.data.status }))
      if (action === 'stop') {
        setChartData([])
        chartPointsRef.current = []
      }
    } catch (err) {
      alert(`Error al ejecutar acción: ${err.response?.data?.error || err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Modificar recursos
  const handleUpdateLimits = async (e) => {
    e.preventDefault()
    setLimitsLoading(true)
    try {
      const response = await api.patch(`/api/admin/instances/${id}`, {
        ramLimit: parseInt(ramLimit),
        cpuLimit: parseFloat(cpuLimit),
        diskLimit: parseInt(diskLimit)
      })
      setInstance(response.data.instance)
      alert('Límites actualizados con éxito en Docker.')
    } catch (err) {
      alert(`Error al guardar límites: ${err.response?.data?.error || err.message}`)
    } finally {
      setLimitsLoading(false)
    }
  }

  // Eliminar Instancia
  const handleDeleteInstance = async () => {
    if (confirmSubdomain.toLowerCase() !== instance.subdomain.toLowerCase()) {
      alert('El nombre del subdominio no coincide.')
      return
    }

    setDeleteLoading(true)
    try {
      await api.delete(`/api/admin/instances/${id}`)
      setShowDeleteModal(false)
      navigate('/admin/dashboard')
    } catch (err) {
      alert(`Error al eliminar instancia: ${err.response?.data?.error || err.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Eliminar SSH Key (como admin)
  const handleDeleteKey = async (keyId) => {
    if (!confirm('¿Seguro que deseas eliminar esta llave SSH? El cliente perderá el acceso directo con esta llave.')) return
    
    // Espera, el endpoint en adminController.js no expone directamente DELETE /api/admin/instances/:id/ssh-keys/:keyId.
    // Sin embargo, podemos eliminarla usando la API de cliente si estuviéramos logueados como cliente, o podemos
    // simular la llamada o simplemente borrarla de la BD. Para que sea coherente, dado que la llave está vinculada,
    // podemos borrarla. Pero para no complicar el routing de admin (que no tenía endpoint de eliminar key individual en el prompt),
    // el cliente puede hacerlo él mismo desde su panel. Si el administrador desea eliminarla, en el prompt no se requiere
    // explícitamente un endpoint para que el admin borre llaves del cliente (solo se lista las llaves del cliente).
    // El prompt dice: "Detalle de instancia: Lista de SSH keys del cliente con opción de eliminar".
    // Ah! Dice "Lista de SSH keys del cliente con opción de eliminar".
    // Esto implica que necesitamos un endpoint o método para que el administrador pueda eliminar la llave SSH de un cliente.
    // Vamos a agregar ese endpoint al backend!
    // Podemos crear un endpoint: `DELETE /api/admin/instances/:instanceId/ssh-keys/:keyId`.
    // Vamos a añadir esta ruta a `admin.js` y `adminController.js`. Es súper fácil.
    
    setSshKeysLoading(true)
    try {
      await api.delete(`/api/admin/instances/${id}/ssh-keys/${keyId}`)
      setSshKeys(prev => prev.filter(k => k.id !== keyId))
      alert('Llave SSH eliminada con éxito.')
    } catch (err) {
      console.error(err)
      alert(`Error al eliminar llave: ${err.response?.data?.error || err.message}`)
    } finally {
      setSshKeysLoading(false)
    }
  }

  if (loading || !instance) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando detalles...</span>
        </div>
      </div>
    )
  }

  const fullDomain = `${instance.subdomain}.moondev.online`

  return (
    <div className="flex-1 p-8 bg-moon-bg min-h-screen relative">
      
      {/* Header and Back Button */}
      <div className="mb-8 flex justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link 
            to="/admin/dashboard"
            className="p-2.5 bg-moon-surface border border-moon-border hover:border-moon-accent/40 text-moon-text hover:text-white rounded-lg transition-all-custom"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-wide">{instance.subdomain}</h2>
              <StatusBadge status={instance.status} />
            </div>
            <p className="text-sm text-moon-text/50 font-mono mt-0.5">
              ID Contenedor: {instance.containerName} | Cliente: {instance.user?.username}
            </p>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex gap-2">
          <button
            onClick={() => handleContainerAction('start')}
            disabled={actionLoading || instance.status === 'RUNNING'}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-semibold tracking-wider font-mono uppercase transition-all-custom"
          >
            <Play size={14} />
            <span>Iniciar</span>
          </button>
          <button
            onClick={() => handleContainerAction('stop')}
            disabled={actionLoading || instance.status === 'STOPPED'}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-semibold tracking-wider font-mono uppercase transition-all-custom"
          >
            <Square size={14} />
            <span>Detener</span>
          </button>
          <button
            onClick={() => handleContainerAction('restart')}
            disabled={actionLoading}
            className="p-2.5 bg-moon-surface hover:bg-moon-border text-moon-text hover:text-white border border-moon-border rounded-lg transition-all-custom"
            title="Reiniciar Contenedor"
          >
            <RotateCcw size={16} className={actionLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side (Chart and limits editing) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Performance Chart */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-6 flex items-center gap-2">
              <Activity size={18} className="text-moon-accent" />
              <span>Rendimiento en Tiempo Real (CPU & RAM)</span>
            </h3>

            {instance.status !== 'RUNNING' ? (
              <div className="h-64 flex items-center justify-center border border-dashed border-moon-border rounded-lg bg-moon-card/30">
                <p className="text-xs text-moon-text/40 font-mono text-center">
                  El contenedor está detenido.<br />Inicia la instancia para comenzar a recibir estadísticas de telemetría.
                </p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center border border-dashed border-moon-border rounded-lg bg-moon-card/30">
                <div className="flex flex-col items-center gap-2">
                  <span className="w-5 h-5 border-2 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
                  <span className="text-xs text-moon-text/40 font-mono">Esperando primer reporte de telemetría...</span>
                </div>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c6af7" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#7c6af7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="name" stroke="#585870" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis stroke="#585870" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8 }}
                      labelStyle={{ color: '#e2e2f0', fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="cpu" name="CPU (%)" stroke="#7c6af7" fillOpacity={1} fill="url(#colorCpu)" />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="mt-6 pt-6 border-t border-moon-border/40 grid grid-cols-1 md:grid-cols-2 gap-6 animate-scale-up">
                  <ResourceBar 
                    label="Uso de RAM en Caliente" 
                    value={stats.ramUsed} 
                    max={stats.ramLimit || instance.ramLimit} 
                    unit="MB" 
                  />
                  <ResourceBar 
                    label="Uso de Almacenamiento (Disco)" 
                    value={stats.diskUsed || 0} 
                    max={stats.diskLimit || instance.diskLimit} 
                    unit="MB" 
                  />
                </div>

                {(stats.diskUsed > (stats.diskLimit || instance.diskLimit)) && (
                  <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>¡Alerta! El cliente ha excedido su límite de almacenamiento asignado ({instance.diskLimit} MB).</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resource Limits Editor */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-6 flex items-center gap-2">
              <Settings size={18} className="text-moon-accent" />
              <span>Editar Límites de Recursos</span>
            </h3>

            <form onSubmit={handleUpdateLimits} className="space-y-6">
              
              {/* RAM Limit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-moon-text/70 uppercase">Límite de RAM</span>
                  <span className="text-white font-bold text-sm">{ramLimit} MB</span>
                </div>
                <input 
                  type="range" 
                  min="128" 
                  max="2048" 
                  step="64"
                  value={ramLimit} 
                  onChange={(e) => setRamLimit(parseInt(e.target.value))}
                  className="w-full accent-moon-accent bg-moon-card h-1.5 rounded-full"
                />
              </div>

              {/* CPU Limit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-moon-text/70 uppercase">Límite de CPU Cores</span>
                  <span className="text-white font-bold text-sm">{cpuLimit} Cores</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="2" 
                  step="0.1"
                  value={cpuLimit} 
                  onChange={(e) => setCpuLimit(parseFloat(e.target.value))}
                  className="w-full accent-moon-accent bg-moon-card h-1.5 rounded-full"
                />
              </div>

              {/* Disk Limit */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-moon-text/70 uppercase">Límite de Disco</span>
                  <span className="text-white font-bold text-sm">{diskLimit} MB</span>
                </div>
                <input 
                  type="number" 
                  min="512" 
                  max="10240"
                  step="256"
                  value={diskLimit} 
                  onChange={(e) => setDiskLimit(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-moon-card border border-moon-border rounded-lg text-white font-mono text-sm focus:outline-none focus:border-moon-accent"
                />
              </div>

              <button
                type="submit"
                disabled={limitsLoading}
                className="px-5 py-2.5 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-lg shadow-md transition-all-custom flex items-center justify-center text-sm disabled:opacity-50"
              >
                {limitsLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Aplicar Límites a Docker'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side (Credentials and SSH Keys) */}
        <div className="space-y-8">
          
          {/* SSH Info Card */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
              <Key size={18} className="text-moon-accent" />
              <span>Acceso Técnico SSH</span>
            </h3>

            {sshInfo ? (
              <div className="space-y-4 font-mono text-xs text-moon-text/80 bg-moon-card p-4 rounded-lg border border-moon-border/60">
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Servidor (Host):</span>
                  <span className="text-white select-all">{sshInfo.host}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Puerto SSH:</span>
                  <span className="text-white select-all">{sshInfo.sshPort}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-moon-border/40">
                  <span className="text-moon-text/50">Usuario:</span>
                  <span className="text-white select-all">{sshInfo.username}</span>
                </div>
                
                {/* Contraseña temporal con ojo */}
                <div className="pt-2 border-t border-moon-border/40">
                  <span className="text-moon-text/50 block mb-1">Contraseña:</span>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded-lg">
                    <span className="text-white font-bold select-all tracking-wider">
                      {showPassword ? sshInfo.password : '••••••••••••'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 hover:bg-moon-border text-moon-text/60 hover:text-white rounded transition-all-custom"
                        title={showPassword ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => handleCopy(sshInfo.password, 'password')}
                        className="p-1 hover:bg-moon-border text-moon-text/60 hover:text-white rounded transition-all-custom"
                        title="Copiar contraseña"
                      >
                        {copiedField === 'password' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comando SSH */}
                <div className="pt-2">
                  <span className="text-moon-text/50 block mb-1">Comando de acceso rápido:</span>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded-lg text-[10px]">
                    <span className="text-white select-all">ssh root@{sshInfo.host} -p {sshInfo.sshPort}</span>
                    <button
                      onClick={() => handleCopy(`ssh root@${sshInfo.host} -p ${sshInfo.sshPort}`, 'sshcmd')}
                      className="p-1 hover:bg-moon-border text-moon-text/60 hover:text-white rounded transition-all-custom"
                      title="Copiar comando"
                    >
                      {copiedField === 'sshcmd' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-moon-text/40 italic">Cargando credenciales SSH...</p>
            )}
          </div>

          {/* SSH Keys List */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
              <Key size={18} className="text-moon-accent" />
              <span>Llaves SSH del Cliente</span>
            </h3>

            {sshKeysLoading ? (
              <div className="flex justify-center p-6">
                <span className="w-5 h-5 border-2 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
              </div>
            ) : sshKeys.length === 0 ? (
              <p className="text-xs text-moon-text/40 italic p-4 border border-dashed border-moon-border rounded-lg bg-moon-card/30 text-center">
                El cliente no ha cargado ninguna llave SSH autorizada.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {sshKeys.map(key => (
                  <div key={key.id} className="p-3 bg-moon-card border border-moon-border rounded-lg flex items-center justify-between gap-3 group">
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-white truncate">{key.label}</p>
                      <p className="text-[10px] text-moon-text/40 font-mono truncate">{key.publicKey}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-red-400 hover:text-white p-1.5 hover:bg-red-950/20 rounded border border-transparent hover:border-red-900/30 shrink-0 transition-all-custom opacity-50 group-hover:opacity-100"
                      title="Eliminar Llave SSH"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-moon-surface border border-rose-500/10 p-6 rounded-xl">
            <h3 className="font-bold text-rose-400 text-sm mb-3 uppercase tracking-wider font-mono">Zona de Peligro</h3>
            <p className="text-xs text-moon-text/50 mb-4">
              Eliminar el entorno del cliente destruirá la instancia docker de inmediato, eliminando archivos y configuraciones.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full py-2.5 px-4 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all-custom"
            >
              Destruir Instancia
            </button>
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
                <h3 className="text-lg font-bold text-white tracking-wide">¿Destruir Instancia Docker?</h3>
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
                <p className="font-semibold text-rose-200">¡ATENCIÓN INMEDIATA!</p>
                <p className="leading-relaxed font-mono">
                  Esta acción es irreversible. Se eliminarán el container, todos los archivos y la configuración de red. El cliente perderá todo su trabajo.
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
                    <span>Eliminar todo</span>
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
