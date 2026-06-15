// frontend/src/pages/admin/GameServers.jsx
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ShieldAlert, X, AlertCircle, Play, RotateCcw, UserPlus, Gamepad2, Info } from 'lucide-react'
import api from '../../api/axios'

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',    dot: 'bg-gray-500',   text: 'text-gray-400',   busy: true  },
  offline:  { label: 'Offline',      dot: 'bg-red-500',    text: 'text-red-400',    busy: false },
  starting: { label: 'Iniciando...',   dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', busy: true  },
  online:   { label: 'Online',       dot: 'bg-green-400',  text: 'text-green-400',  busy: false },
  stopping: { label: 'Deteniendo...',  dot: 'bg-orange-400 animate-pulse', text: 'text-orange-400', busy: true  },
}

export default function GameServers() {
  const [servers, setServers] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  // Loading por acciones específicas
  const [actionLoading, setActionLoading] = useState({})

  // Form de creación
  const [newServerData, setNewServerData] = useState({
    name: '',
    gameType: 'valheim',
    containerId: '',
    containerName: '',
    queryPort: ''
  })
  const [createLoading, setCreateLoading] = useState(false)

  // Selección de servidor para gestión de acceso / reset
  const [selectedServer, setSelectedServer] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserRole, setSelectedUserRole] = useState('player')
  const [accessLoading, setAccessLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const fetchData = async () => {
    try {
      const [serversRes, clientsRes] = await Promise.all([
        api.get('/api/admin/game/instances'),
        api.get('/api/admin/clients')
      ])
      setServers(serversRes.data)
      setClients(clientsRes.data)
      setError('')
    } catch (err) {
      console.error('[GAMESERVERS FETCH ERROR]', err)
      setError('Error al obtener los datos del panel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateServer = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setError('')
    try {
      await api.post('/api/admin/game/instances', {
        ...newServerData,
        queryPort: parseInt(newServerData.queryPort)
      })
      await fetchData()
      setShowCreateModal(false)
      setNewServerData({
        name: '',
        gameType: 'valheim',
        containerId: '',
        containerName: '',
        queryPort: ''
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la instancia de juego.')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleActivate = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'activate' }))
    try {
      await api.post(`/api/admin/game/instances/${id}/activate`)
      await fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al activar la instancia.')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta instancia de juego del panel? (El contenedor Docker no se borrará del host)')) return
    setActionLoading(prev => ({ ...prev, [id]: 'delete' }))
    try {
      await api.delete(`/api/admin/game/instances/${id}`)
      await fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar la instancia.')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  const handleGrantAccess = async (e) => {
    e.preventDefault()
    if (!selectedServer || !selectedUserId) return
    setAccessLoading(true)
    setError('')
    try {
      await api.post(`/api/admin/game/instances/${selectedServer.id}/access`, {
        userId: selectedUserId,
        role: selectedUserRole
      })
      
      // Consultar y actualizar listado completo de servidores
      const serversRes = await api.get('/api/admin/game/instances')
      setServers(serversRes.data)
      
      const freshServer = serversRes.data.find(s => s.id === selectedServer.id)
      if (freshServer) {
        setSelectedServer(freshServer)
      }
      setSelectedUserId('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al otorgar acceso.')
    } finally {
      setAccessLoading(false)
    }
  }

  const handleRevokeAccess = async (userId) => {
    if (!selectedServer) return
    setAccessLoading(true)
    try {
      await api.delete(`/api/admin/game/instances/${selectedServer.id}/access/${userId}`)
      await fetchData()
      // Actualizar modal state
      setSelectedServer(prev => ({
        ...prev,
        userAccess: prev.userAccess.filter(ua => ua.userId !== userId)
      }))
    } catch (err) {
      alert(err.response?.data?.error || 'Error al revocar acceso.')
    } finally {
      setAccessLoading(false)
    }
  }

  const handleResetWorld = async () => {
    if (!selectedServer) return
    setResetLoading(true)
    setError('')
    try {
      const res = await api.post(`/api/admin/game/instances/${selectedServer.id}/reset-world`)
      alert(res.data?.message || 'Mundo reseteado con éxito.')
      setShowResetModal(false)
      setSelectedServer(null)
      await fetchData()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer el mundo.')
    } finally {
      setResetLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando servidores...</span>
        </div>
      </div>
    )
  }

  // Stats
  const totalServers = servers.length
  const onlineServers = servers.filter(s => s.status === 'online').length
  const offlineServers = servers.filter(s => s.status === 'offline').length
  const pendingServers = servers.filter(s => s.status === 'pending').length

  return (
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen relative text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-wide flex items-center gap-2">
            <Gamepad2 size={24} className="text-moon-accent" />
            <span>Servidores de Juego</span>
          </h2>
          <p className="text-sm text-moon-text/50 font-mono">Administración y control de accesos para Valheim y Minecraft Bedrock</p>
        </div>
        <button
          onClick={() => {
            setError('')
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-3 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-lg shadow-lg shadow-moon-accent/20 hover:shadow-moon-hover/30 transition-all-custom text-sm self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Registrar Servidor</span>
        </button>
      </div>

      {error && !showCreateModal && !showAccessModal && !showResetModal && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg font-mono flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-moon-surface border border-moon-border p-5 rounded-xl">
          <p className="text-xs font-semibold text-moon-text/50 uppercase tracking-wider font-mono">Servidores Registrados</p>
          <p className="text-2xl font-bold mt-2">{totalServers}</p>
        </div>
        <div className="bg-moon-surface border border-moon-border p-5 rounded-xl">
          <p className="text-xs font-semibold text-moon-text/50 uppercase tracking-wider font-mono">En Línea (Online)</p>
          <p className="text-2xl font-bold text-green-400 mt-2">{onlineServers}</p>
        </div>
        <div className="bg-moon-surface border border-moon-border p-5 rounded-xl">
          <p className="text-xs font-semibold text-moon-text/50 uppercase tracking-wider font-mono">Apagados (Offline)</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{offlineServers}</p>
        </div>
        <div className="bg-moon-surface border border-moon-border p-5 rounded-xl">
          <p className="text-xs font-semibold text-moon-text/50 uppercase tracking-wider font-mono">Pendientes de Activar</p>
          <p className="text-2xl font-bold text-yellow-500 mt-2">{pendingServers}</p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {servers.length === 0 ? (
            <div className="p-12 text-center text-moon-text/50 font-mono">
              No hay servidores de juego registrados en el panel.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-moon-border text-moon-text/40 font-semibold text-xs tracking-wider uppercase font-mono bg-moon-card/30">
                  <th className="p-4">Servidor</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Contenedor</th>
                  <th className="p-4">Puerto Query</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acceso de Jugadores</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-moon-border/60 text-sm text-white/90">
                {servers.map(server => {
                  const s = STATUS_CONFIG[server.status] ?? STATUS_CONFIG.offline
                  return (
                    <tr key={server.id} className="hover:bg-moon-card/25 transition-all-custom font-mono">
                      <td className="p-4 font-bold text-white font-sans">{server.name}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-black/40 border border-white/5 capitalize">
                          {server.gameType}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-moon-text/80">{server.containerName}</td>
                      <td className="p-4 text-xs">{server.queryPort}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs ${s.text}`}>{s.label}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {server.userAccess && server.userAccess.map(acc => (
                            <span key={acc.userId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-moon-card border border-moon-border rounded text-[10px] text-moon-text/90">
                              <span>{acc.user?.username || acc.userId}</span>
                              <span className="text-[8px] bg-white/10 px-1 rounded uppercase">{acc.role}</span>
                            </span>
                          ))}
                          <button
                            onClick={() => {
                              setSelectedServer(server);
                              setError('');
                              setShowAccessModal(true);
                            }}
                            className="p-1 text-moon-accent hover:text-white hover:bg-moon-accent/20 border border-transparent rounded transition-all-custom"
                            title="Gestionar Accesos"
                          >
                            <UserPlus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {server.status === 'pending' && (
                            <button
                              onClick={() => handleActivate(server.id)}
                              disabled={!!actionLoading[server.id]}
                              className="px-2.5 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded text-xs font-semibold transition-all-custom flex items-center gap-1"
                            >
                              <Play size={12} />
                              <span>Activar</span>
                            </button>
                          )}
                          {server.status === 'offline' && (
                            <button
                              onClick={() => {
                                setSelectedServer(server);
                                setError('');
                                setShowResetModal(true);
                              }}
                              className="p-2 text-yellow-500 hover:text-white hover:bg-yellow-950/20 border border-transparent hover:border-yellow-900/30 rounded-lg transition-all-custom"
                              title="Restablecer Mundo (Wipe)"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          {server.status !== 'online' && (
                            <button
                              onClick={() => handleDelete(server.id)}
                              disabled={!!actionLoading[server.id]}
                              className="p-2 text-rose-400 hover:text-white hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 rounded-lg transition-all-custom"
                              title="Eliminar Servidor"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Registrar Servidor */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-moon-border/60 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-wide">Registrar Servidor de Juego</h3>
                <p className="text-xs text-moon-text/50 font-mono mt-0.5">Asociar un contenedor Docker de juego existente</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-moon-text/40 hover:text-white transition-all-custom">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateServer}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">Nombre del Servidor</label>
                  <input
                    type="text"
                    required
                    value={newServerData.name}
                    onChange={(e) => setNewServerData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ej: Valheim - Servidor Oficial"
                    className="w-full px-4 py-2 bg-moon-card border border-moon-border text-white text-sm rounded-lg focus:outline-none focus:border-moon-accent transition-all-custom"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">Tipo de Juego</label>
                    <select
                      value={newServerData.gameType}
                      onChange={(e) => setNewServerData(prev => ({ ...prev, gameType: e.target.value }))}
                      className="w-full px-4 py-2 bg-moon-card border border-moon-border text-white text-sm rounded-lg focus:outline-none focus:border-moon-accent"
                    >
                      <option value="valheim">Valheim</option>
                      <option value="minecraft">Minecraft Bedrock</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">Puerto Query UDP</label>
                    <input
                      type="number"
                      required
                      value={newServerData.queryPort}
                      onChange={(e) => setNewServerData(prev => ({ ...prev, queryPort: e.target.value }))}
                      placeholder="ej: 2456"
                      className="w-full px-4 py-2 bg-moon-card border border-moon-border text-white text-sm rounded-lg focus:outline-none focus:border-moon-accent transition-all-custom font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">ID del Contenedor Docker</label>
                  <input
                    type="text"
                    required
                    value={newServerData.containerId}
                    onChange={(e) => setNewServerData(prev => ({ ...prev, containerId: e.target.value }))}
                    placeholder="ej: moondev-valheim"
                    className="w-full px-4 py-2 bg-moon-card border border-moon-border text-white text-sm rounded-lg focus:outline-none focus:border-moon-accent transition-all-custom font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">Nombre Legible del Contenedor</label>
                  <input
                    type="text"
                    required
                    value={newServerData.containerName}
                    onChange={(e) => setNewServerData(prev => ({ ...prev, containerName: e.target.value }))}
                    placeholder="ej: moondev-valheim"
                    className="w-full px-4 py-2 bg-moon-card border border-moon-border text-white text-sm rounded-lg focus:outline-none focus:border-moon-accent transition-all-custom font-mono"
                  />
                </div>
              </div>

              <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-moon-accent hover:bg-moon-hover text-white rounded-lg text-sm font-semibold transition-all-custom flex items-center gap-1.5"
                >
                  {createLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gestionar Accesos */}
      {showAccessModal && selectedServer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-moon-border/60 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-wide">Gestionar Accesos de Jugadores</h3>
                <p className="text-xs text-moon-text/50 font-mono mt-0.5">Servidor: <span className="text-white font-bold">{selectedServer.name}</span></p>
              </div>
              <button onClick={() => setShowAccessModal(false)} className="text-moon-text/40 hover:text-white transition-all-custom">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Form de otorgar acceso */}
              <form onSubmit={handleGrantAccess} className="p-4 bg-moon-card rounded-lg border border-moon-border/60 flex flex-col gap-4">
                <h4 className="text-xs font-semibold text-moon-text/75 uppercase tracking-wider font-mono">Conceder Nuevo Acceso</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-moon-text/60 font-semibold uppercase">Seleccionar Cliente</label>
                    <select
                      required
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3 py-2 bg-moon-bg border border-moon-border text-white text-xs rounded-lg focus:outline-none focus:border-moon-accent font-sans"
                    >
                      <option value="">-- Seleccionar --</option>
                      {clients.map(cli => (
                        <option key={cli.id} value={cli.id}>{cli.username} ({cli.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-moon-text/60 font-semibold uppercase">Rol de Acceso</label>
                    <select
                      value={selectedUserRole}
                      onChange={(e) => setSelectedUserRole(e.target.value)}
                      className="w-full px-3 py-2 bg-moon-bg border border-moon-border text-white text-xs rounded-lg focus:outline-none focus:border-moon-accent font-sans"
                    >
                      <option value="owner">Dueño (Owner)</option>
                      <option value="player">Jugador (Player)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={accessLoading || !selectedUserId}
                  className="px-4 py-2 bg-moon-accent hover:bg-moon-hover text-white text-xs font-semibold rounded-lg transition-all-custom flex items-center justify-center gap-1.5 self-end disabled:opacity-40"
                >
                  {accessLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Dar Acceso'}
                </button>
              </form>

              {/* Lista actual de accesos */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-moon-text/50 uppercase tracking-wider font-mono">Jugadores con Acceso</h4>
                {(!selectedServer.userAccess || selectedServer.userAccess.length === 0) ? (
                  <p className="text-xs text-moon-text/40 font-mono italic">Sin jugadores autorizados aún.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedServer.userAccess.map(acc => (
                      <div key={acc.userId} className="flex items-center justify-between p-2.5 bg-moon-card rounded-lg border border-moon-border/40 text-xs font-mono">
                        <div>
                          <p className="font-semibold text-white font-sans">{acc.user?.username || 'Cargando...'}</p>
                          <p className="text-[10px] text-moon-text/60">{acc.user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded uppercase font-bold">{acc.role}</span>
                          <button
                            onClick={() => handleRevokeAccess(acc.userId)}
                            className="p-1 text-rose-400 hover:text-white hover:bg-rose-950/40 rounded transition-all-custom"
                            title="Revocar Acceso"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAccessModal(false)}
                className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Restablecer Mundo (Wipe) */}
      {showResetModal && selectedServer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-moon-surface border border-rose-500/25 rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 bg-rose-500/10 border-b border-rose-500/20 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white tracking-wide">¿Restablecer Mundo de Juego?</h3>
                <p className="text-xs text-rose-400/80 font-mono mt-0.5">Servidor: <span className="font-bold">{selectedServer.name}</span></p>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-moon-text/40 hover:text-white transition-all-custom">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="p-4 bg-rose-950/25 border border-rose-900/40 text-rose-300 text-xs rounded-lg space-y-1.5 font-mono leading-relaxed">
                <p className="font-semibold text-rose-200 uppercase">¡Advertencia de Limpieza de Mundo!</p>
                <p>Esta acción es irreversible y realizará un borrado completo del directorio de archivos de guardado (saves/worlds).</p>
                <p>El servidor generará un mundo nuevo automáticamente en su próximo arranque.</p>
              </div>
            </div>

            <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetLoading}
                onClick={handleResetWorld}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold transition-all-custom flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                {resetLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Wipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
