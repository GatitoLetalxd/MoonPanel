import React, { useEffect, useState, useRef } from 'react'
import { useGameContext } from '../hooks/useGameContext'
import axios from '../api/axios'
import { 
  Play, 
  Square, 
  RotateCcw, 
  ShieldAlert, 
  Cpu, 
  HardDrive, 
  Settings, 
  Users, 
  History, 
  Download, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Gamepad2, 
  Info,
  Check,
  ChevronDown
} from 'lucide-react'

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',    dot: 'bg-gray-500',   text: 'text-gray-400',   busy: true  },
  offline:  { label: 'Offline',      dot: 'bg-red-500',    text: 'text-red-400',    busy: false },
  starting: { label: 'Iniciando...',   dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', busy: true  },
  online:   { label: 'Online',       dot: 'bg-green-400',  text: 'text-green-400',  busy: false },
  stopping: { label: 'Deteniendo...',  dot: 'bg-orange-400 animate-pulse', text: 'text-orange-400', busy: true  },
}

export default function GameDashboard() {
  const ctx = useGameContext()
  const [instances, setInstances] = useState([])
  const [activeInstance, setActiveInstance] = useState(null)
  const [activeTab, setActiveTab] = useState('server') // 'server' | 'options' | 'backups'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Estados del servidor activo
  const [stats, setStats] = useState({ cpu: '0.00', ramUsed: 0, ramLimit: 0, diskUsed: 0 })
  const [config, setConfig] = useState({})
  const [configData, setConfigData] = useState({})
  const [backups, setBackups] = useState([])

  // Loaders específicos
  const [actionLoading, setActionLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)
  const [backupRestoring, setBackupRestoring] = useState(null)
  const [backupDeleting, setBackupDeleting] = useState(null)

  // Dropdown de seleccionar servidor
  const [showSelector, setShowSelector] = useState(false)

  useEffect(() => {
    fetchInstances()
  }, [])

  // Cargar lista de instancias
  async function fetchInstances() {
    try {
      const { data } = await axios.get('/api/game/instances')
      setInstances(data)
      if (data.length > 0) {
        // Restaurar activa o seleccionar primera
        const storedActiveId = localStorage.getItem('activeGameInstanceId')
        const exists = data.find(i => String(i.id) === storedActiveId)
        if (exists) {
          setActiveInstance(exists)
        } else {
          setActiveInstance(data[0])
          localStorage.setItem('activeGameInstanceId', data[0].id)
        }
      }
      setError(null)
    } catch (err) {
      setError('No se pudo conectar con el servidor del panel.')
    } finally {
      setLoading(false)
    }
  }

  // Polling de estado y estadísticas
  useEffect(() => {
    if (!activeInstance) return

    let active = true

    // Fetch status
    async function updateStatus() {
      try {
        const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/status`)
        if (active) {
          setActiveInstance(prev => {
            if (!prev || prev.id !== activeInstance.id) return prev
            if (prev.status !== data.status || prev.playersConnected !== data.playersConnected) {
              return { ...prev, status: data.status, playersConnected: data.playersConnected }
            }
            return prev
          })
        }
      } catch (err) {
        console.error('Error polling status:', err)
      }
    }

    // Fetch stats
    async function updateStats() {
      if (activeInstance.status !== 'online') {
        setStats({ cpu: '0.00', ramUsed: 0, ramLimit: 0, diskUsed: 0 })
        return
      }
      try {
        const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/stats`)
        if (active) {
          setStats(data)
        }
      } catch (err) {
        console.error('Error polling stats:', err)
      }
    }

    updateStatus()
    updateStats()

    const intervalStatus = setInterval(updateStatus, 5000)
    const intervalStats = setInterval(updateStats, 7000)

    return () => {
      active = false
      clearInterval(intervalStatus)
      clearInterval(intervalStats)
    }
  }, [activeInstance?.id, activeInstance?.status])

  // Cargar contenido según tab
  useEffect(() => {
    if (!activeInstance) return

    if (activeTab === 'options') {
      fetchConfig()
    } else if (activeTab === 'backups') {
      fetchBackups()
    }
  }, [activeInstance?.id, activeTab])

  // Fetch config
  async function fetchConfig() {
    setConfigLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/config`)
      setConfig(data)
      setConfigData(data)
    } catch (err) {
      alert('Error al obtener la configuración del servidor de juego.')
    } finally {
      setConfigLoading(false)
    }
  }

  // Fetch backups
  async function fetchBackups() {
    setBackupsLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/backups`)
      setBackups(data)
    } catch (err) {
      alert('Error al listar los respaldos de mundo.')
    } finally {
      setBackupsLoading(false)
    }
  }

  // Controlar ciclo de vida (iniciar, parar, reiniciar)
  async function handleLifecycleAction(action) {
    if (!activeInstance) return
    setActionLoading(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/${action}`)
      setActiveInstance(prev => ({ ...prev, status: data.status }))
    } catch (err) {
      alert(err?.response?.data?.error ?? `Error al ejecutar: ${action}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Restablecer / Wipe Mundo
  async function handleResetWorld() {
    if (!activeInstance) return
    if (!window.confirm('¿Estás seguro de restablecer el mundo? Esta acción eliminará permanentemente todos tus avances y construcciones. No se puede deshacer.')) return
    setActionLoading(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/reset-world`)
      alert(data.message)
      setActiveInstance(prev => ({ ...prev, status: 'offline' }))
    } catch (err) {
      alert(err?.response?.data?.error ?? 'Error al restablecer el mundo.')
    } finally {
      setActionLoading(false)
    }
  }

  // Guardar configuración
  async function handleSaveConfig(e) {
    e.preventDefault()
    if (!activeInstance) return

    // Validaciones
    if (activeInstance.gameType === 'valheim' && configData.SERVER_PASS && configData.SERVER_PASS.length < 5) {
      alert('La contraseña de Valheim debe tener al menos 5 caracteres.')
      return
    }

    setConfigSaving(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/config`, configData)
      alert(data.message)
      setActiveInstance(prev => ({ ...prev, status: data.status }))
      if (data.status === 'starting') {
        setActiveTab('server')
      }
    } catch (err) {
      alert(err?.response?.data?.error ?? 'Error al guardar la configuración.')
    } finally {
      setConfigSaving(false)
    }
  }

  // Crear respaldo
  async function handleCreateBackup() {
    if (!activeInstance) return
    setBackupCreating(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/backups`)
      alert(data.message)
      fetchBackups()
    } catch (err) {
      alert(err?.response?.data?.error ?? 'Error al crear el respaldo.')
    } finally {
      setBackupCreating(false)
    }
  }

  // Restaurar respaldo
  async function handleRestoreBackup(filename) {
    if (!activeInstance) return
    if (!window.confirm(`¿Estás seguro de restaurar el respaldo "${filename}"? El estado actual del mundo será sobrescrito.`)) return
    setBackupRestoring(filename)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/backups/restore`, { filename })
      alert(data.message)
    } catch (err) {
      alert(err?.response?.data?.error ?? 'Error al restaurar el respaldo.')
    } finally {
      setBackupRestoring(null)
    }
  }

  // Eliminar respaldo
  async function handleDeleteBackup(filename) {
    if (!activeInstance) return
    if (!window.confirm(`¿Estás seguro de eliminar el respaldo "${filename}"?`)) return
    setBackupDeleting(filename)
    try {
      const { data } = await axios.delete(`/api/game/instances/${activeInstance.id}/backups`, { data: { filename } })
      alert(data.message)
      fetchBackups()
    } catch (err) {
      alert(err?.response?.data?.error ?? 'Error al eliminar el respaldo.')
    } finally {
      setBackupDeleting(null)
    }
  }

  // Cambiar instancia activa
  function selectInstance(inst) {
    setActiveInstance(inst)
    localStorage.setItem('activeGameInstanceId', inst.id)
    setShowSelector(false)
    setActiveTab('server')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-moon-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando servidores...</span>
        </div>
      </div>
    )
  }

  if (instances.length === 0 && !error) {
    return (
      <div className="flex-1 p-8 bg-moon-bg min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md bg-moon-surface border border-moon-border p-8 rounded-xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Gamepad2 size={20} />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">Sin Servidores Asignados</h3>
          <p className="text-xs text-moon-text/50 font-mono">
            No tienes acceso a ningún servidor de juego. Comunícate con el administrador para que te asigne permisos.
          </p>
        </div>
      </div>
    )
  }

  const s = STATUS_CONFIG[activeInstance?.status] ?? STATUS_CONFIG.offline
  const busy = s.busy || actionLoading

  return (
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen relative text-white">
      {/* Header & Selector */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8 pb-6 border-b border-moon-border/40">
        <div className="relative">
          <button 
            onClick={() => setShowSelector(!showSelector)}
            className="flex items-center gap-2 bg-moon-surface hover:bg-moon-card border border-moon-border px-4 py-2.5 rounded-lg text-left transition-all-custom focus:outline-none"
          >
            <Gamepad2 size={18} className="text-moon-accent shrink-0" />
            <div>
              <p className="text-[10px] text-moon-text/50 uppercase tracking-wider font-semibold font-mono">Gestionando Servidor</p>
              <p className="font-bold text-white pr-4 flex items-center gap-1.5 font-sans">
                <span>{activeInstance?.name}</span>
                <ChevronDown size={14} className="text-moon-text/50" />
              </p>
            </div>
          </button>

          {showSelector && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-moon-surface border border-moon-border rounded-xl shadow-2xl z-50 overflow-hidden animate-scale-up font-mono">
              <div className="p-3 border-b border-moon-border/50 text-[10px] uppercase font-bold text-moon-text/40 tracking-wider">
                Selecciona un servidor
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-moon-border/30">
                {instances.map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => selectInstance(inst)}
                    className={`w-full text-left p-3.5 hover:bg-moon-card flex justify-between items-center transition-colors ${
                      inst.id === activeInstance?.id ? 'bg-moon-card border-l-2 border-moon-accent' : ''
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-white font-sans text-xs">{inst.name}</p>
                      <p className="text-[10px] text-moon-text/40 capitalize">{inst.gameType} | {inst.queryPort}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[inst.status]?.dot ?? 'bg-gray-500'}`} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info del Subdominio */}
        <div className="bg-moon-surface border border-moon-border/60 rounded-lg p-3 font-mono text-xs max-w-sm flex items-center gap-3 self-start sm:self-auto">
          <div className="px-2.5 py-1 bg-black/40 border border-white/5 rounded text-[10px] font-bold text-moon-text uppercase tracking-wider">
            Dominio
          </div>
          <div>
            <p className="text-white font-bold select-all">
              {activeInstance?.gameType === 'valheim' ? 'vh.moondev.online' : 'mc.moondev.online'}
            </p>
            <p className="text-[10px] text-moon-text/40">Puerto Query: {activeInstance?.queryPort}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg font-mono flex items-center gap-2">
          <Info size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-moon-border/40 gap-1.5 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('server')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 font-sans ${
            activeTab === 'server'
              ? 'border-moon-accent text-moon-accent bg-moon-accent/5'
              : 'border-transparent text-moon-text/60 hover:text-white hover:bg-moon-border/10'
          }`}
        >
          <Gamepad2 size={16} />
          <span>Servidor</span>
        </button>

        <button
          onClick={() => setActiveTab('options')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 font-sans ${
            activeTab === 'options'
              ? 'border-moon-accent text-moon-accent bg-moon-accent/5'
              : 'border-transparent text-moon-text/60 hover:text-white hover:bg-moon-border/10'
          }`}
        >
          <Settings size={16} />
          <span>Opciones</span>
        </button>

        <button
          onClick={() => setActiveTab('backups')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 font-sans ${
            activeTab === 'backups'
              ? 'border-moon-accent text-moon-accent bg-moon-accent/5'
              : 'border-transparent text-moon-text/60 hover:text-white hover:bg-moon-border/10'
          }`}
        >
          <History size={16} />
          <span>Respaldos de Mundo</span>
        </button>
      </div>

      {/* TAB CONTENT: SERVER */}
      {activeTab === 'server' && activeInstance && (
        <div className="space-y-8 animate-scale-up">
          {/* Status Display Card */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl flex flex-col md:flex-row gap-6 md:items-center justify-between shadow-xl">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-moon-card border border-moon-border text-moon-text/60 ${
                activeInstance.status === 'online' ? 'text-green-400 border-green-500/25 bg-green-500/5' : ''
              }`}>
                <Gamepad2 size={24} className={activeInstance.status === 'starting' ? 'animate-spin text-yellow-400' : ''} />
              </div>
              <div>
                <h3 className="text-lg font-bold font-sans">{activeInstance.name}</h3>
                <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  <span className={`font-semibold ${s.text}`}>{s.label}</span>
                  {activeInstance.status === 'online' && (
                    <span className="text-moon-text/50">
                      • {activeInstance.playersConnected} jugadores en línea
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {activeInstance.status === 'offline' && (
                <button
                  onClick={() => handleLifecycleAction('start')}
                  disabled={busy}
                  className="px-5 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-lg font-semibold transition-all-custom flex items-center gap-2 text-sm shadow-lg shadow-green-600/10 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play size={16} />
                  <span>Encender</span>
                </button>
              )}

              {activeInstance.status === 'online' && (
                <>
                  <button
                    onClick={() => handleLifecycleAction('stop')}
                    disabled={busy}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg font-semibold transition-all-custom flex items-center gap-2 text-sm shadow-lg shadow-rose-600/10 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Square size={16} />
                    <span>Apagar</span>
                  </button>

                  <button
                    onClick={() => handleLifecycleAction('restart')}
                    disabled={busy}
                    className="px-5 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white rounded-lg font-semibold transition-all-custom flex items-center gap-2 text-sm shadow-lg shadow-yellow-600/10 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <RotateCcw size={16} />
                    <span>Reiniciar</span>
                  </button>
                </>
              )}

              {['starting', 'stopping'].includes(activeInstance.status) && (
                <button disabled className="px-5 py-3 bg-moon-card border border-moon-border text-moon-text/40 rounded-lg text-sm font-semibold flex items-center gap-2 animate-pulse">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>En transición...</span>
                </button>
              )}

              {/* Reset/Wipe button (Only for Owners when server is Offline) */}
              {activeInstance.status === 'offline' && activeInstance.userRole === 'owner' && (
                <button
                  onClick={handleResetWorld}
                  disabled={busy}
                  className="px-5 py-3 bg-transparent hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-sm font-semibold transition-all-custom flex items-center gap-2 shadow-sm"
                  title="Borrar archivos de guardado y generar un mundo nuevo"
                >
                  <RotateCcw size={15} />
                  <span>Restablecer Mundo</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-moon-surface border border-moon-border p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Cpu size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-moon-text/40 uppercase font-semibold font-sans tracking-wide">Uso de CPU</p>
                <p className="text-xl font-bold text-white mt-1">{stats.cpu}%</p>
              </div>
            </div>

            <div className="bg-moon-surface border border-moon-border p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                <HardDrive size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-moon-text/40 uppercase font-semibold font-sans tracking-wide">Memoria RAM</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats.ramUsed} MB <span className="text-xs text-moon-text/50 font-normal">/ {stats.ramLimit || '512'} MB</span>
                </p>
              </div>
            </div>

            <div className="bg-moon-surface border border-moon-border p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <HardDrive size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-moon-text/40 uppercase font-semibold font-sans tracking-wide">Disco Duro</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats.diskUsed} MB <span className="text-xs text-moon-text/50 font-normal">usados</span>
                </p>
              </div>
            </div>

            <div className="bg-moon-surface border border-moon-border p-5 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-moon-text/40 uppercase font-semibold font-sans tracking-wide">Jugadores</p>
                <p className="text-xl font-bold text-white mt-1">
                  {activeInstance.status === 'online' ? activeInstance.playersConnected : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Auto-sleep Alert Banner */}
          {activeInstance.status === 'online' && (
            <div className="p-4 bg-moon-card border border-moon-border/80 rounded-xl flex items-start gap-3 text-xs leading-relaxed max-w-2xl font-mono">
              <Info size={16} className="text-moon-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white font-sans text-sm mb-0.5">Auto-Suspensión Activa (Auto-Sleep)</p>
                <p className="text-moon-text/60">
                  Para conservar recursos de la infraestructura, el servidor se apagará automáticamente si se detectan **0 jugadores conectados durante 5 minutos consecutivos**. 
                  Cualquier miembro con permisos puede encenderlo nuevamente en un segundo.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: OPTIONS */}
      {activeTab === 'options' && activeInstance && (
        <div className="bg-moon-surface border border-moon-border rounded-xl p-6 md:p-8 max-w-2xl animate-scale-up">
          <div className="mb-6 flex items-start gap-3">
            <Settings size={22} className="text-moon-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold font-sans">Configuración del Servidor</h3>
              <p className="text-xs text-moon-text/50 font-mono mt-0.5">Edita las opciones principales. Guardar cambios requerirá detener/recrear el contenedor.</p>
            </div>
          </div>

          {configLoading ? (
            <div className="p-12 text-center text-moon-text/40 font-mono flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-moon-accent" />
              <span>Cargando configuraciones...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Form fields based on Game Type */}
              {activeInstance.gameType === 'valheim' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Nombre del Servidor (SERVER_NAME)</label>
                    <input
                      type="text"
                      required
                      value={configData.SERVER_NAME || ''}
                      onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_NAME: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-sans font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Nombre del Mundo (WORLD_NAME)</label>
                    <input
                      type="text"
                      required
                      value={configData.WORLD_NAME || ''}
                      onChange={(e) => setConfigData(prev => ({ ...prev, WORLD_NAME: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Contraseña de Entrada (SERVER_PASS)</label>
                      <input
                        type="text"
                        required
                        value={configData.SERVER_PASS || ''}
                        onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_PASS: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-mono font-semibold tracking-wider"
                      />
                      <p className="text-[10px] text-moon-text/45 font-mono">Mínimo 5 caracteres. Requerido por Valheim.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Servidor Público (SERVER_PUBLIC)</label>
                      <select
                        value={configData.SERVER_PUBLIC || 'false'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_PUBLIC: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-mono"
                      >
                        <option value="true">Sí (Aparece en el buscador de salas de Steam)</option>
                        <option value="false">No (Solo conexión directa por IP/Puerto)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeInstance.gameType === 'minecraft' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Nombre del Servidor (SERVER_NAME)</label>
                    <input
                      type="text"
                      required
                      value={configData.SERVER_NAME || ''}
                      onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_NAME: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-sans font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Modo de Juego (GAMEMODE)</label>
                      <select
                        value={configData.GAMEMODE || 'survival'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, GAMEMODE: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-mono capitalize"
                      >
                        <option value="survival">Survival</option>
                        <option value="creative">Creative</option>
                        <option value="adventure">Adventure</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Dificultad (DIFFICULTY)</label>
                      <select
                        value={configData.DIFFICULTY || 'normal'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, DIFFICULTY: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all-custom font-mono capitalize"
                      >
                        <option value="peaceful">Peaceful</option>
                        <option value="easy">Easy</option>
                        <option value="normal">Normal</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Botones de Guardado */}
              {activeInstance.userRole === 'owner' ? (
                <div className="pt-4 border-t border-moon-border/40 flex justify-end gap-3 font-sans">
                  <button
                    type="button"
                    onClick={fetchConfig}
                    className="px-4 py-2 border border-moon-border hover:bg-moon-border/40 text-moon-text hover:text-white rounded-lg text-sm font-semibold transition-all-custom"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="px-5 py-2.5 bg-moon-accent hover:bg-moon-hover text-white rounded-lg text-sm font-semibold shadow-lg shadow-moon-accent/15 transition-all-custom flex items-center gap-1.5"
                  >
                    {configSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar y Aplicar'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-moon-card border border-moon-border/40 text-moon-text/50 rounded-lg text-xs leading-relaxed font-mono flex items-center gap-2">
                  <Info size={16} />
                  <span>Solo el propietario (owner) asignado por GatitoLetal puede editar las configuraciones.</span>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* TAB CONTENT: BACKUPS */}
      {activeTab === 'backups' && activeInstance && (
        <div className="space-y-6 max-w-4xl animate-scale-up">
          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div className="flex items-start gap-3">
              <History size={22} className="text-moon-accent shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold font-sans">Respaldos del Mundo de Juego</h3>
                <p className="text-xs text-moon-text/50 font-mono mt-0.5">Respaldos comprimidos del directorio de guardado del servidor (saves/worlds).</p>
              </div>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={backupCreating}
              className="px-4 py-2.5 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-lg shadow-moon-accent/20 transition-all-custom flex items-center gap-1.5 self-start sm:self-auto font-sans"
            >
              {backupCreating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Crear Respaldo</span>
            </button>
          </div>

          {/* List backups */}
          <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden font-mono">
            {backupsLoading ? (
              <div className="p-12 text-center text-moon-text/40 flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-moon-accent" />
                <span>Cargando lista de respaldos...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-12 text-center text-moon-text/40 leading-relaxed italic text-xs">
                No hay respaldos creados para este servidor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-moon-border text-[10px] text-moon-text/40 font-semibold tracking-wider uppercase bg-moon-card/30">
                      <th className="p-4">Archivo</th>
                      <th className="p-4">Tamaño</th>
                      <th className="p-4">Fecha de Creación</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-moon-border/60 text-xs text-white/90">
                    {backups.map(b => (
                      <tr key={b.filename} className="hover:bg-moon-card/25 transition-all-custom">
                        <td className="p-4 font-bold text-white/95 truncate max-w-xs">{b.filename}</td>
                        <td className="p-4">{(b.sizeBytes / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="p-4 text-moon-text/75">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Download */}
                            <a
                              href={`${axios.defaults.baseURL}/api/game/instances/${activeInstance.id}/backups/${b.filename}/download`}
                              headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }}
                              onClick={(e) => {
                                // Como es un tag a, pasamos el token por query param para descarga directa
                                e.preventDefault()
                                const token = localStorage.getItem('token')
                                window.open(`${axios.defaults.baseURL}/api/game/instances/${activeInstance.id}/backups/${b.filename}/download?token=${token || ''}`)
                              }}
                              className="p-2 text-moon-text/80 hover:text-white hover:bg-moon-card border border-moon-border/50 rounded transition-all-custom"
                              title="Descargar archivo"
                            >
                              <Download size={14} />
                            </a>

                            {/* Restore (Only Owner, server must be Offline) */}
                            {activeInstance.userRole === 'owner' && (
                              <button
                                onClick={() => handleRestoreBackup(b.filename)}
                                disabled={activeInstance.status !== 'offline' || backupRestoring !== null}
                                className="px-2.5 py-1.5 bg-yellow-700/80 hover:bg-yellow-600 disabled:opacity-35 text-white font-semibold rounded text-[10px] transition-all-custom flex items-center gap-1 font-sans"
                                title={activeInstance.status !== 'offline' ? 'Apaga el servidor para restaurar' : 'Restaurar mundo'}
                              >
                                {backupRestoring === b.filename ? <RefreshCw size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                                <span>Restaurar</span>
                              </button>
                            )}

                            {/* Delete (Only Owner) */}
                            {activeInstance.userRole === 'owner' && (
                              <button
                                onClick={() => handleDeleteBackup(b.filename)}
                                disabled={backupDeleting !== null}
                                className="p-2 text-rose-400 hover:text-white hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 rounded transition-all-custom"
                                title="Eliminar respaldo"
                              >
                                {backupDeleting === b.filename ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
