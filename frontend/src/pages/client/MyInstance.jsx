import React, { useState, useEffect } from 'react'
import { Server, Play, Square, RotateCcw, Copy, Check, Eye, EyeOff, Terminal, ExternalLink, AlertCircle } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import ResourceBar from '../../components/ResourceBar'
import api from '../../api/axios'

export default function MyInstance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState('')
  const [stats, setStats] = useState({ cpu: '0.00', ramUsed: 0, ramLimit: 0 })

  const loadData = async () => {
    try {
      const response = await api.get('/api/client/instance')
      setData(response.data)
      setStats(prev => ({
        ...prev,
        ramLimit: response.data.instance.ramLimit
      }))
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
                    {/* Convertir porcentaje relativo al límite asignado */}
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

        {/* Right Side: SSH Access Card */}
        <div>
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Terminal size={18} className="text-moon-accent" />
              <span>Acceso SSH del Contenedor</span>
            </h3>

            {/* Custom technical card layout (requested background #0d0d14 and JetBrains Mono) */}
            <div className="bg-moon-card border border-moon-border rounded-lg p-5 font-mono text-xs text-moon-text/85 space-y-4">
              
              <div className="space-y-1">
                <span className="text-moon-text/40 uppercase text-[10px] tracking-wider font-semibold">Comando SSH</span>
                <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                  <span className="text-emerald-400 select-all font-semibold break-all">
                    ssh root@{sshInfo.host} -p {sshInfo.sshPort}
                  </span>
                  <button
                    onClick={() => handleCopy(`ssh root@${sshInfo.host} -p ${sshInfo.sshPort}`, 'sshcmd')}
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
                    {showPassword ? sshInfo.password : '••••••••••••'}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => handleCopy(sshInfo.password, 'password')}
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
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
