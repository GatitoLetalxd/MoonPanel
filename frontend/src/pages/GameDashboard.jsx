// frontend/src/pages/GameDashboard.jsx
import { useEffect, useState } from 'react'
import { useGameContext } from '../hooks/useGameContext'
import axios from '../api/axios'

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',    dot: 'bg-gray-500',   text: 'text-gray-400',   busy: true  },
  offline:  { label: 'Offline',      dot: 'bg-red-500',    text: 'text-red-400',    busy: false },
  starting: { label: 'Iniciando...',   dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', busy: true  },
  online:   { label: 'Online',       dot: 'bg-green-400',  text: 'text-green-400',  busy: false },
  stopping: { label: 'Deteniendo...',  dot: 'bg-orange-400 animate-pulse', text: 'text-orange-400', busy: true  },
}

export default function GameDashboard() {
  const ctx = useGameContext()
  const [instances, setInstances]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [error, setError]                 = useState(null)

  useEffect(() => {
    fetchInstances()
    const poll = setInterval(fetchInstances, 15_000)
    return () => clearInterval(poll)
  }, [])

  async function fetchInstances() {
    try {
      const { data } = await axios.get('/api/game/instances')
      setInstances(data)
      setError(null)
    } catch (err) {
      setError('No se pudo conectar con el servidor del panel.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(instanceId, action) {
    setActionLoading(prev => ({ ...prev, [instanceId]: action }))
    try {
      await axios.post(`/api/game/instances/${instanceId}/${action}`)
      await fetchInstances()
    } catch (err) {
      alert(err?.response?.data?.error ?? `Error al ejecutar: ${action}`)
    } finally {
      setActionLoading(prev => ({ ...prev, [instanceId]: null }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: ctx.bg }}>
        <p className="animate-pulse text-lg" style={{ color: ctx.color }}>
          Cargando servidores...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: ctx.bg, color: '#ffffff' }}>

      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <span className="text-3xl">{ctx.icon}</span>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: ctx.color }}>
            {ctx.label}
          </h1>
          <p className="text-sm text-gray-500 font-mono">Panel de servidores</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/25 border border-rose-500/20 text-rose-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Sin instancias */}
      {instances.length === 0 && !error && (
        <div className="text-center mt-24 text-gray-600">
          <p className="text-4xl mb-3">{ctx.icon}</p>
          <p>No tienes servidores asignados.</p>
          <p className="text-sm mt-1">Contacta al administrador para obtener acceso.</p>
        </div>
      )}

      {/* Tarjetas de instancias */}
      <div className="grid gap-4 max-w-xl">
        {instances.map(instance => {
          const s    = STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.offline
          const busy = s.busy || !!actionLoading[instance.id]

          return (
            <div
              key={instance.id}
              className="rounded-xl p-5 flex flex-col gap-4 border"
              style={{ backgroundColor: ctx.accent, borderColor: '#1a1a3a' }}
            >
              {/* Info */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">{instance.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
                    <span className={`text-sm font-mono ${s.text}`}>{s.label}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 bg-black/35 px-2.5 py-1 rounded-full capitalize font-mono border border-white/5">
                  {instance.gameType}
                </span>
              </div>

              {/* Info auto-sleep */}
              {instance.status === 'online' && (
                <p className="text-xs text-gray-500 border-t border-white/5 pt-3 font-mono">
                  Se apagará automáticamente tras 5 minutos sin jugadores.
                </p>
              )}

              {/* Acciones */}
              <div className="flex gap-2 flex-wrap">
                {instance.status === 'offline' && (
                  <button
                    onClick={() => handleAction(instance.id, 'start')}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40
                               bg-green-700 hover:bg-green-600 active:scale-95"
                  >
                    {actionLoading[instance.id] === 'start' ? 'Iniciando...' : 'Iniciar'}
                  </button>
                )}

                {instance.status === 'online' && (
                  <>
                    <button
                      onClick={() => handleAction(instance.id, 'stop')}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40
                                 bg-red-800 hover:bg-red-700 active:scale-95"
                    >
                      {actionLoading[instance.id] === 'stop' ? 'Deteniendo...' : 'Detener'}
                    </button>
                    <button
                      onClick={() => handleAction(instance.id, 'restart')}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40
                                 bg-yellow-800 hover:bg-yellow-700 active:scale-95"
                    >
                      {actionLoading[instance.id] === 'restart' ? 'Reiniciando...' : 'Reiniciar'}
                    </button>
                  </>
                )}

                {/* Estado de transición → botones deshabilitados con feedback */}
                {['starting', 'stopping'].includes(instance.status) && (
                  <button disabled className="px-4 py-2 rounded-lg text-sm font-medium opacity-40 bg-gray-700">
                    {instance.status === 'starting' ? 'Iniciando...' : 'Deteniendo...'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
