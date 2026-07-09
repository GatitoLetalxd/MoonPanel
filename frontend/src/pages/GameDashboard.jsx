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
  ChevronDown,
  Copy,
  Terminal,
  Folder,
  Globe,
  UploadCloud,
  FileText,
  ChevronRight,
  Save,
  Sliders,
  Sparkles,
  ArrowLeft,
  Package,
  Zap,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Lock,
  Globe2,
  X
} from 'lucide-react'

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',    dot: 'bg-gray-500',   text: 'text-gray-400',   busy: true  },
  offline:  { label: 'Offline',      dot: 'bg-red-500',    text: 'text-red-400',    busy: false },
  starting: { label: 'Iniciando...',   dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', busy: true  },
  online:   { label: 'Online',       dot: 'bg-green-400',  text: 'text-green-400',  busy: false },
  stopping: { label: 'Deteniendo...',  dot: 'bg-orange-400 animate-pulse', text: 'text-orange-400', busy: true  },
}

const BEDROCK_VERSIONS = [
  "1.26.32.2", "1.26.31.1", "1.26.30.5", "1.26.23.1", "1.26.21.1", "1.26.20.5", "1.26.20.4",
  "1.26.14.1", "1.26.13.1", "1.26.12.2", "1.26.11.1", "1.26.10.4", "1.26.3.1", "1.26.2.1",
  "1.26.1.1", "1.26.0.2", "1.21.132.3", "1.21.132.1", "1.21.131.1", "1.21.130.4", "1.21.130.3",
  "1.21.124.2", "1.21.123.2", "1.21.122.2", "1.21.121.1", "1.21.120.4", "1.21.114.1", "1.21.113.1",
  "1.21.112.1", "1.21.111.1", "1.21.102.1", "1.21.101.1", "1.21.100.7", "1.21.100.6", "1.21.95.1",
  "1.21.94.2", "1.21.94.1", "1.21.93.1", "1.21.92.1", "1.21.91.1", "1.21.90.4", "1.21.84.1",
  "1.21.83.1", "1.21.82.1", "1.21.81.2", "1.21.80.3", "1.21.73.01", "1.21.72.02", "1.21.71.01",
  "1.21.70.04", "1.21.62.01", "1.21.61.01", "1.21.60.10", "1.21.51.02", "1.21.51.01", "1.21.50.10",
  "1.21.44.01", "1.21.43.01", "1.21.42.01", "1.21.41.01", "1.21.40.03", "1.21.31.04", "1.21.30.03",
  "1.21.23.01", "1.21.22.01", "1.21.20.03", "1.21.3.01", "1.21.2.02", "1.21.1.03", "1.21.0.03",
  "1.20.81.01", "1.20.80.05", "1.20.73.01", "1.20.72.01", "1.20.71.01", "1.20.70.05", "1.20.62.03",
  "1.20.62.02", "1.20.61.01", "1.20.51.01", "1.20.50.03", "1.20.41.02", "1.20.40.01", "1.20.32.03",
  "1.20.31.01", "1.20.30.02", "1.20.15.01", "1.20.14.01", "1.20.13.01", "1.20.12.01", "1.20.11.01",
  "1.20.10.01", "1.20.1.02", "1.20.0.01", "1.19.83.01", "1.19.81.01", "1.19.80.02", "1.19.73.02",
  "1.19.72.01", "1.19.71.02", "1.19.70.02", "1.19.63.01", "1.19.62.01", "1.19.61.01", "1.19.60.04",
  "1.19.52.01", "1.19.51.01", "1.19.50.02", "1.19.41.01", "1.19.40.02", "1.19.31.01", "1.19.30.04",
  "1.19.22.01", "1.19.21.01", "1.19.20.02", "1.19.11.01", "1.19.10.03", "1.19.2.02", "1.19.1.01",
  "1.18.33.02", "1.18.32.02", "1.18.31.04", "1.18.30.04", "1.18.12.01", "1.18.11.01", "1.18.2.03",
  "1.18.1.02", "1.18.0.02", "1.17.41.01", "1.17.40.06", "1.17.34.02", "1.17.33.01", "1.17.32.02",
  "1.17.31.01", "1.17.30.04", "1.17.11.01", "1.17.10.04", "1.17.2.01", "1.17.1.01", "1.17.0.03",
  "1.16.221.01", "1.16.220.02", "1.16.210.06", "1.16.210.05", "1.16.201.03", "1.16.201.02", "1.16.200.02",
  "1.16.101.01", "1.16.100.04", "1.16.40.02", "1.16.20.03", "1.16.1.02", "1.16.0.2", "1.14.60.5",
  "1.14.32.1", "1.14.30.2", "1.14.21.0", "1.14.20.1", "1.14.1.4", "1.14.0.9", "1.13.3.0",
  "1.13.2.0", "1.13.1.5", "1.13.0.34", "1.12.1.1", "1.12.0.28", "1.11.4.2", "1.11.2.1",
  "1.11.1.2", "1.11.0.23", "1.10.0.7", "1.9.0.15", "1.8.1.2", "1.8.0.24", "1.7.0.13",
  "1.6.1.0"
]


const VALHEIM_STARTING_MESSAGES = [
  "Descargando servidor via SteamCMD...",
  "Cargando archivos del mundo...",
  "Generando ubicaciones del mapa...",
  "Colocando cuevas de trolls...",
  "Colocando cuevas de montaña...",
  "Creando bosques y vegetación...",
  "Colocando estructuras de Mistlands...",
  "Colocando criptas ancestrales...",
  "Inicializando motor de red...",
  "Esperando puertos de red..."
]

export default function GameDashboard() {
  const ctx = useGameContext()
  const [instances, setInstances] = useState([])
  const [activeInstance, setActiveInstance] = useState(null)
  const [activeTab, setActiveTab] = useState('server') // 'server' | 'options' | 'files' | 'worlds' | 'backups'
  const [loading, setLoading] = useState(true)
  const [valheimMsgIndex, setValheimMsgIndex] = useState(0)
  const [error, setError] = useState(null)

  // Estados del servidor activo
  const [stats, setStats] = useState({ cpu: '0.00', ramUsed: 0, ramLimit: 0, diskUsed: 0 })
  const [config, setConfig] = useState({})
  const [configData, setConfigData] = useState({})
  const [backups, setBackups] = useState([])

  // Consola y Logs (Minecraft)
  const [logs, setLogs] = useState('')
  const [commandInput, setCommandInput] = useState('')
  const [consoleExecuting, setConsoleExecuting] = useState(false)

  // Explorador de archivos (Minecraft)
  const [currentFilePath, setCurrentFilePath] = useState('')
  const [filesList, setFilesList] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [editingFile, setEditingFile] = useState(null)
  const [fileSaving, setFileSaving] = useState(false)

  // Opciones de Minecraft (server.properties)
  const [mcProperties, setMcProperties] = useState({})
  const [mcPropertiesData, setMcPropertiesData] = useState({})

  // Opciones de mundo (Minecraft)
  const [worldUploading, setWorldUploading] = useState(false)
  const [newWorldSeed, setNewWorldSeed] = useState('')
  const [newWorldDifficulty, setNewWorldDifficulty] = useState('normal')
  const [newWorldName, setNewWorldName] = useState('')
  const [worldGenerating, setWorldGenerating] = useState(false)
  const [activeGamerules, setActiveGamerules] = useState({})
  const [gameruleInputs, setGameruleInputs] = useState({})

  // World settings (level.dat)
  const [worldData, setWorldData] = useState(null)
  const [worldDataLoading, setWorldDataLoading] = useState(false)
  const [worldDataSaving, setWorldDataSaving] = useState(false)
  const [experimentsSaving, setExperimentsSaving] = useState(false)
  const [localExperiments, setLocalExperiments] = useState({})
  const [localLevelDat, setLocalLevelDat] = useState({})

  // Add-ons (Minecraft Bedrock)
  const [addons, setAddons] = useState([])
  const [addonsLoading, setAddonsLoading] = useState(false)
  const [addonUploading, setAddonUploading] = useState(false)
  const [addonDeleting, setAddonDeleting] = useState(null)
  const [addonActivating, setAddonActivating] = useState(null)
  const [addonDragOver, setAddonDragOver] = useState(false)

  // Single property saving states
  const [savingProperty, setSavingProperty] = useState(null)
  const [savedProperty, setSavedProperty] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    isDestructive: false
  })

  function triggerConfirm(title, message, onConfirm, isDestructive = false) {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm,
      isDestructive
    })
  }

  // Loaders específicos
  const [actionLoading, setActionLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)
  const [backupRestoring, setBackupRestoring] = useState(null)
  const [backupDeleting, setBackupDeleting] = useState(null)

  // Estados de éxito guardado
  const [configSaved, setConfigSaved] = useState(false)
  const [mcVersionSaved, setMcVersionSaved] = useState(false)
  const [fileSaved, setFileSaved] = useState(false)

  // Sistema de toasts no invasivo
  const [toasts, setToasts] = useState([])
  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // Dropdown de seleccionar servidor
  const [showSelector, setShowSelector] = useState(false)
  const [copiedField, setCopiedField] = useState('')

  const consoleEndRef = useRef(null)

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  useEffect(() => {
    fetchInstances()
  }, [])

  // Cargar lista de instancias
  async function fetchInstances() {
    try {
      const { data } = await axios.get('/api/game/instances')
      setInstances(data)
      if (data.length > 0) {
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

    async function updateStatus() {
      try {
        const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/status`)
        if (active) {
          setActiveInstance(prev => {
            if (!prev || prev.id !== activeInstance.id) return prev
            if (
              prev.status !== data.status ||
              prev.playersConnected !== data.playersConnected ||
              prev.runningVersion !== data.runningVersion ||
              prev.loadingMessage !== data.loadingMessage
            ) {
              return {
                ...prev,
                status: data.status,
                playersConnected: data.playersConnected,
                runningVersion: data.runningVersion,
                loadingMessage: data.loadingMessage
              }
            }
            return prev
          })
        }
      } catch (err) {
        console.error('Error polling status:', err)
      }
    }

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

    const intervalStatus = setInterval(
      updateStatus,
      activeInstance.status === 'starting' || activeInstance.status === 'stopping' ? 1000 : 5000
    )
    const intervalStats = setInterval(updateStats, 7000)

    return () => {
      active = false
      clearInterval(intervalStatus)
      clearInterval(intervalStats)
    }
  }, [activeInstance?.id, activeInstance?.status])

  useEffect(() => {
    if (!activeInstance || activeInstance.status !== 'starting' || activeInstance.gameType !== 'valheim') {
      return
    }
    const interval = setInterval(() => {
      setValheimMsgIndex(prev => (prev + 1) % VALHEIM_STARTING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [activeInstance?.id, activeInstance?.status, activeInstance?.gameType])

  // Polling de logs (Consola Minecraft / Valheim)
  async function fetchLogs() {
    if (!activeInstance || (activeInstance.gameType !== 'minecraft' && activeInstance.gameType !== 'valheim')) return
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/logs`)
      setLogs(data.logs)
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  useEffect(() => {
    if (!activeInstance || (activeInstance.gameType !== 'minecraft' && activeInstance.gameType !== 'valheim') || activeTab !== 'server' || activeInstance.status !== 'online') return
    fetchLogs()
    const interval = setInterval(fetchLogs, 4000)
    return () => clearInterval(interval)
  }, [activeInstance?.id, activeTab, activeInstance?.status])

  // Desplazamiento automático al final de la consola desactivado a petición del usuario

  // Cargar contenido según tab
  useEffect(() => {
    if (!activeInstance) return

    if (activeTab === 'options') {
      if (activeInstance.gameType === 'minecraft') {
        fetchMcOptions()
      } else {
        fetchConfig()
      }
    } else if (activeTab === 'backups') {
      fetchBackups()
    } else if (activeTab === 'files') {
      fetchFiles('')
    } else if (activeTab === 'world-settings') {
      if (activeInstance.gameType === 'minecraft') {
        fetchGamerules()
        fetchWorldData()
      }
    } else if (activeTab === 'addons') {
      if (activeInstance.gameType === 'minecraft') {
        fetchAddons()
        fetchWorldData()
      }
    }
  }, [activeInstance?.id, activeTab])

  // Fetch config (Valheim)
  async function fetchConfig() {
    setConfigLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/config`)
      setConfig(data)
      setConfigData(data)
    } catch (err) {
      showToast('Error al obtener la configuración del servidor.', 'error')
    } finally {
      setConfigLoading(false)
    }
  }

  // Fetch Minecraft options (both config and properties)
  async function fetchMcOptions() {
    setConfigLoading(true)
    try {
      const [propsRes, configRes] = await Promise.all([
        axios.get(`/api/game/instances/${activeInstance.id}/mc/properties`),
        axios.get(`/api/game/instances/${activeInstance.id}/config`)
      ])
      setMcProperties(propsRes.data)
      setMcPropertiesData(propsRes.data)
      setConfig(configRes.data)
      setConfigData(configRes.data)
    } catch (err) {
      showToast('Error al obtener la configuración de Minecraft.', 'error')
    } finally {
      setConfigLoading(false)
    }
  }

  // Fetch server.properties (Minecraft)
  async function fetchMcProperties() {
    setConfigLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/properties`)
      setMcProperties(data)
      setMcPropertiesData(data)
    } catch (err) {
      showToast('Error al obtener las propiedades del servidor Minecraft.', 'error')
    } finally {
      setConfigLoading(false)
    }
  }

  // Fetch gamerules (Minecraft)
  async function fetchGamerules() {
    if (!activeInstance || activeInstance.gameType !== 'minecraft') return
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/world/gamerules`)
      setActiveGamerules(data)
      setGameruleInputs(prev => ({
        ...prev,
        randomTickSpeed: data.randomTickSpeed || '5',
        spawnRadius: data.spawnRadius || '10'
      }))
    } catch (err) {
      console.error('Error fetching gamerules:', err)
    }
  }

  // Fetch world data from level.dat (Minecraft)
  async function fetchWorldData() {
    if (!activeInstance || activeInstance.gameType !== 'minecraft') return
    setWorldDataLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/world`)
      setWorldData(data)
      if (data && data.levelDatExists !== false) {
        setLocalLevelDat({
          IsHardcore: data.hardcore,
          GameType: data.gameType,
          LevelName: data.levelName,
          Difficulty: data.difficulty,
          commandsEnabled: data.commandsEnabled,
          cheatsEnabled: data.cheatsEnabled,
          EducationFeatures: data.educationFeaturesEnabled
        })
        setLocalExperiments(data.experiments || {})
      } else {
        setLocalLevelDat({})
        setLocalExperiments({})
      }
    } catch (err) {
      console.error('Error fetching world data:', err)
    } finally {
      setWorldDataLoading(false)
    }
  }

  // Save level.dat fields (requires server offline)
  async function handleSaveWorldData(e) {
    e.preventDefault()
    if (!activeInstance) return
    setWorldDataSaving(true)
    try {
      await axios.post(`/api/game/instances/${activeInstance.id}/mc/world/leveldat`, localLevelDat)
      await fetchWorldData()
      console.log('Opciones de mundo guardadas correctamente.')
    } catch (err) {
      showToast('Error al guardar: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setWorldDataSaving(false)
    }
  }

  // Save experiments (requires server offline)
  async function handleSaveExperiments(e) {
    e.preventDefault()
    if (!activeInstance) return
    setExperimentsSaving(true)
    try {
      await axios.post(`/api/game/instances/${activeInstance.id}/mc/world/experiments`, localExperiments)
      await fetchWorldData()
      console.log('Experimentos guardados correctamente.')
    } catch (err) {
      showToast('Error al guardar experimentos: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setExperimentsSaving(false)
    }
  }

  // Fetch installed addons list
  async function fetchAddons() {
    if (!activeInstance || activeInstance.gameType !== 'minecraft') return
    setAddonsLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/addons`)
      setAddons(data)
    } catch (err) {
      console.error('Error fetching addons:', err)
    } finally {
      setAddonsLoading(false)
    }
  }

  // Upload addon file
  async function handleAddonUpload(file) {
    if (!file || !activeInstance) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['mcpack', 'mcaddon', 'zip'].includes(ext)) {
      showToast('Formato no soportado. Solo se aceptan .mcpack, .mcaddon y .zip', 'error')
      return
    }
    setAddonUploading(true)
    try {
      const formData = new FormData()
      formData.append('addon', file)
      const { data } = await axios.post(
        `/api/game/instances/${activeInstance.id}/mc/addons/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      showToast(`Add-on instalado correctamente: ${data.installed.map(p => p.manifest.name).join(', ')}`)
      fetchAddons()
    } catch (err) {
      showToast('Error al instalar el add-on: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setAddonUploading(false)
    }
  }

  // Toggle addon activation in world
  async function handleAddonToggle(addon) {
    if (!activeInstance) return
    setAddonActivating(addon.uuid)
    try {
      await axios.post(`/api/game/instances/${activeInstance.id}/mc/addons/activate`, {
        uuid: addon.uuid,
        version: addon.version,
        packType: addon.packType,
        activate: !addon.active
      })
      fetchAddons()
    } catch (err) {
      showToast('Error: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setAddonActivating(null)
    }
  }

  // Fully uninstall addon (Muestra modal)
  function handleAddonUninstall(addon) {
    if (!activeInstance) return
    triggerConfirm(
      '¿Desinstalar Add-on?',
      `¿Desinstalar "${addon.name}"? Se eliminará de la base del mundo y del servidor de manera irreversible.`,
      () => executeAddonUninstall(addon),
      true
    )
  }

  // Ejecución real de la desinstalación
  async function executeAddonUninstall(addon) {
    setAddonDeleting(addon.uuid)
    try {
      await axios.delete(`/api/game/instances/${activeInstance.id}/mc/addons`, {
        data: { folderName: addon.folderName, uuid: addon.uuid, packType: addon.packType }
      })
      fetchAddons()
    } catch (err) {
      showToast('Error al desinstalar: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setAddonDeleting(null)
    }
  }

  // Fetch backups
  async function fetchBackups() {
    setBackupsLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/backups`)
      setBackups(data)
    } catch (err) {
      showToast('Error al listar los respaldos del servidor.', 'error')
    } finally {
      setBackupsLoading(false)
    }
  }

  // Explorador de archivos (Minecraft)
  async function fetchFiles(relPath = '') {
    setFilesLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/files?path=${encodeURIComponent(relPath)}`)
      setFilesList(data)
      setCurrentFilePath(relPath)
      setEditingFile(null)
    } catch (err) {
      showToast('Error al listar archivos: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setFilesLoading(false)
    }
  }

  async function handleOpenFile(file) {
    setFilesLoading(true)
    try {
      const { data } = await axios.get(`/api/game/instances/${activeInstance.id}/mc/files/view?path=${encodeURIComponent(file.relativePath)}`)
      setEditingFile({
        path: file.relativePath,
        name: file.name,
        content: data.content
      })
    } catch (err) {
      showToast('Error al abrir el archivo: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setFilesLoading(false)
    }
  }

  async function handleSaveFile() {
    if (!editingFile) return
    setFileSaving(true)
    try {
      await axios.post(`/api/game/instances/${activeInstance.id}/mc/files/save`, {
        path: editingFile.path,
        content: editingFile.content
      })
      setFileSaved(true)
      setTimeout(() => setFileSaved(false), 3000)
      const parentDir = editingFile.path.substring(0, editingFile.path.lastIndexOf('/'))
      fetchFiles(parentDir)
    } catch (err) {
      showToast('Error al guardar el archivo: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setFileSaving(false)
    }
  }

  // Enviar comando a la consola (Minecraft)
  async function handleSendCommand(e) {
    e.preventDefault()
    if (!commandInput.trim() || !activeInstance) return
    const cmd = commandInput.trim()
    setCommandInput('')
    setConsoleExecuting(true)

    setLogs(prev => prev + `\n> ${cmd}`)

    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/mc/console`, { command: cmd })
      if (data.output) {
        setLogs(prev => prev + `\n${data.output}`)
      } else {
        setLogs(prev => prev + `\n[Consola] Comando ejecutado con éxito.`)
      }
      fetchLogs()
    } catch (err) {
      setLogs(prev => prev + `\nError al ejecutar: ${err?.response?.data?.error ?? err.message}`)
    } finally {
      setConsoleExecuting(false)
    }
  }

  // Cambiar regla de juego (Gamerule Minecraft Bedrock)
  async function handleGameruleChange(rule, val) {
    if (!activeInstance) return
    setActiveGamerules(prev => ({ ...prev, [rule]: val }))
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/mc/world/gamerule`, {
        rule,
        value: val
      })
      console.log(data.message)
      if (activeInstance.status === 'online') {
        fetchLogs()
      }
    } catch (err) {
      showToast('Error al aplicar gamerule: ' + (err?.response?.data?.error ?? err.message), 'error')
      fetchGamerules()
    }
  }

  // Guardar una propiedad individual del server.properties (estilo Aternos)
  async function handleSaveSingleProperty(key, val) {
    if (!activeInstance) return
    setSavingProperty(key)
    try {
      const updatedProps = { ...mcPropertiesData, [key]: val }
      await axios.post(`/api/game/instances/${activeInstance.id}/mc/properties`, updatedProps)
      setMcProperties(updatedProps)
      setMcPropertiesData(updatedProps)
      setSavedProperty(key)
      setTimeout(() => setSavedProperty(null), 2500)
    } catch (err) {
      showToast('Error al guardar la propiedad: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setSavingProperty(null)
    }
  }

  // Generar nuevo mundo (Muestra modal)
  function handleGenerateWorld(e) {
    e.preventDefault()
    if (!activeInstance) return
    triggerConfirm(
      '¿Generar Nuevo Mundo?',
      'El mundo actual será eliminado permanentemente y no se podrá recuperar. Si el servidor está encendido, se reiniciará.',
      () => executeGenerateWorld(),
      true
    )
  }

  // Ejecución real de la generación
  async function executeGenerateWorld() {
    setWorldGenerating(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/mc/world/generate`, {
        seed: newWorldSeed,
        difficulty: newWorldDifficulty,
        levelName: newWorldName
      })
      console.log(data.message)
      setActiveInstance(prev => ({ ...prev, status: data.status }))
      setActiveTab('server')
    } catch (err) {
      showToast('Error al generar el mundo: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setWorldGenerating(false)
    }
  }

  // Descargar mundo ZIP
  const handleDownloadWorld = () => {
    const token = localStorage.getItem('token')
    window.open(`${axios.defaults.baseURL}/api/game/instances/${activeInstance.id}/mc/world/download?token=${token || ''}`)
  }

  // Subir mundo ZIP (Muestra modal)
  function handleUploadWorld(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      showToast('El archivo supera el límite de 100 MB permitido.', 'warning')
      return
    }
    const inputElement = e.target
    triggerConfirm(
      '¿Subir este Mundo?',
      'Esto sobrescribirá y reemplazará el mundo actual por completo. Si el servidor está encendido, se detendrá.',
      () => executeUploadWorld(file, inputElement),
      true
    )
  }

  // Ejecución real de la subida
  async function executeUploadWorld(file, inputElement) {
    setWorldUploading(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/mc/world/upload`, file, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      })
      console.log(data.message)
      setActiveInstance(prev => ({ ...prev, status: data.status }))
      setActiveTab('server')
    } catch (err) {
      showToast('Error al subir el mundo: ' + (err?.response?.data?.error ?? err.message), 'error')
    } finally {
      setWorldUploading(false)
      if (inputElement) inputElement.value = null
    }
  }

  // Controlar ciclo de vida (iniciar, parar, reiniciar)
  async function handleLifecycleAction(action) {
    if (!activeInstance) return
    setActionLoading(true)
    const previousStatus = activeInstance.status
    // Optimistic UI updates
    if (action === 'start' || action === 'restart') {
      setActiveInstance(prev => ({ ...prev, status: 'starting', loadingMessage: null }))
    } else if (action === 'stop') {
      setActiveInstance(prev => ({ ...prev, status: 'stopping', loadingMessage: null }))
    }
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/${action}`)
      setActiveInstance(prev => {
        if (!prev || prev.id !== activeInstance.id) return prev
        return { ...prev, status: data.status }
      })
    } catch (err) {
      setActiveInstance(prev => {
        if (!prev || prev.id !== activeInstance.id) return prev
        return { ...prev, status: previousStatus }
      })
      showToast(err?.response?.data?.error ?? `Error al ejecutar: ${action}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Restablecer / Wipe Mundo (Muestra modal)
  function handleResetWorld() {
    if (!activeInstance) return
    triggerConfirm(
      '¿Restablecer el Mundo?',
      'Esta acción eliminará permanentemente todos tus avances, construcciones e inventarios del mundo actual. Esta operación no se puede deshacer.',
      () => executeResetWorld(),
      true
    )
  }

  // Ejecución real del restablecimiento del mundo
  async function executeResetWorld() {
    if (!activeInstance) return
    setActionLoading(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/reset-world`)
      console.log(data.message)
      setActiveInstance(prev => ({ ...prev, status: 'offline' }))
    } catch (err) {
      showToast(err?.response?.data?.error ?? 'Error al restablecer el mundo.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Guardar configuración (Valheim)
  async function handleSaveConfig(e) {
    e.preventDefault()
    if (!activeInstance) return
    if (activeInstance.gameType === 'valheim' && configData.SERVER_PASS && configData.SERVER_PASS.length < 5) {
      showToast('La contraseña de Valheim debe tener al menos 5 caracteres.', 'warning')
      return
    }

    setConfigSaving(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/config`, configData)
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
      setActiveInstance(prev => ({ ...prev, status: data.status }))
      if (data.status === 'starting') {
        setActiveTab('server')
      }
    } catch (err) {
      showToast(err?.response?.data?.error ?? 'Error al guardar la configuración.', 'error')
    } finally {
      setConfigSaving(false)
    }
  }

  // Actualizar versión de Minecraft
  async function handleSaveMcVersion(e) {
    e.preventDefault()
    if (!activeInstance) return
    if (activeInstance.status === 'online') {
      showToast('Debes apagar el servidor primero antes de cambiar la versión.', 'warning')
      return
    }
    setConfigSaving(true)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/config`, {
        VERSION: configData.VERSION || 'LATEST'
      })
      setMcVersionSaved(true)
      setTimeout(() => setMcVersionSaved(false), 3000)
      if (data.status) {
        setActiveInstance(prev => ({ ...prev, status: data.status }))
      }
      fetchMcOptions()
    } catch (err) {
      showToast(err?.response?.data?.error ?? 'Error al actualizar la versión del servidor.', 'error')
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
      console.log(data.message)
      fetchBackups()
    } catch (err) {
      showToast(err?.response?.data?.error ?? 'Error al crear el respaldo.', 'error')
    } finally {
      setBackupCreating(false)
    }
  }

  // Restaurar respaldo (Muestra modal)
  function handleRestoreBackup(filename) {
    if (!activeInstance) return
    triggerConfirm(
      '¿Restaurar Respaldo?',
      `¿Estás seguro de restaurar el respaldo "${filename}"? El estado actual del mundo será sobrescrito.`,
      () => executeRestoreBackup(filename),
      true
    )
  }

  // Ejecución real del restore
  async function executeRestoreBackup(filename) {
    setBackupRestoring(filename)
    try {
      const { data } = await axios.post(`/api/game/instances/${activeInstance.id}/backups/restore`, { filename })
      console.log(data.message)
    } catch (err) {
      showToast(err?.response?.data?.error ?? 'Error al restaurar el respaldo.', 'error')
    } finally {
      setBackupRestoring(null)
    }
  }

  // Eliminar respaldo (Muestra modal)
  function handleDeleteBackup(filename) {
    if (!activeInstance) return
    triggerConfirm(
      '¿Eliminar Respaldo?',
      `¿Estás seguro de eliminar el respaldo "${filename}" permanentemente?`,
      () => executeDeleteBackup(filename),
      true
    )
  }

  // Ejecución real de delete
  async function executeDeleteBackup(filename) {
    setBackupDeleting(filename)
    try {
      const { data } = await axios.delete(`/api/game/instances/${activeInstance.id}/backups`, { data: { filename } })
      console.log(data.message)
      fetchBackups()
    } catch (err) {
      showToast(err?.response?.data?.error ?? 'Error al eliminar el respaldo.', 'error')
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

  const getBreadcrumbs = () => {
    const parts = currentFilePath.split('/').filter(Boolean)
    return (
      <div className="flex items-center gap-1.5 text-xs font-mono text-moon-text/60 mb-4 bg-moon-card/30 border border-moon-border/40 px-3.5 py-2 rounded-lg">
        <button onClick={() => fetchFiles('')} className="hover:text-white transition-colors">Raíz</button>
        {parts.map((part, index) => {
          const pathUpTo = parts.slice(0, index + 1).join('/')
          return (
            <React.Fragment key={index}>
              <span className="text-moon-text/30">/</span>
              <button onClick={() => fetchFiles(pathUpTo)} className="hover:text-white transition-colors truncate max-w-[120px]">{part}</button>
            </React.Fragment>
          )
        })}
      </div>
    )
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

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-sans backdrop-blur-sm animate-fadeIn pointer-events-auto transition-all ${
              toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : toast.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {toast.type === 'error'
              ? <X size={15} className="shrink-0 mt-0.5 text-rose-400" />
              : toast.type === 'warning'
                ? <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                : <Check size={15} className="shrink-0 mt-0.5 text-emerald-400" />}
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header & Selector */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8 pb-6 border-b border-moon-border/40">
        <div className="relative">
          <button 
            onClick={() => setShowSelector(!showSelector)}
            className="flex items-center gap-2 bg-moon-surface hover:bg-moon-card border border-moon-border px-4 py-2.5 rounded-lg text-left transition-all focus:outline-none"
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
            <div className="absolute top-full left-0 mt-2 w-64 bg-moon-surface border border-moon-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono">
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

        {activeInstance?.gameType === 'minecraft' && (
          <>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 font-sans ${
                activeTab === 'files'
                  ? 'border-moon-accent text-moon-accent bg-moon-accent/5'
                  : 'border-transparent text-moon-text/60 hover:text-white hover:bg-moon-border/10'
              }`}
            >
              <Folder size={16} />
              <span>Archivos</span>
            </button>


            <button
              onClick={() => setActiveTab('world-settings')}
              className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 font-sans ${
                activeTab === 'world-settings'
                  ? 'border-moon-accent text-moon-accent bg-moon-accent/5'
                  : 'border-transparent text-moon-text/60 hover:text-white hover:bg-moon-border/10'
              }`}
            >
              <Globe2 size={16} />
              <span>Mundo</span>
            </button>

            <button
              onClick={() => setActiveTab('addons')}
              className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 font-sans ${
                activeTab === 'addons'
                  ? 'border-moon-accent text-moon-accent bg-moon-accent/5'
                  : 'border-transparent text-moon-text/60 hover:text-white hover:bg-moon-border/10'
              }`}
            >
              <Package size={16} />
              <span>Add-ons</span>
            </button>
          </>
        )}

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
        <div className="space-y-8">
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
                  <span className={`font-semibold ${s.text}`}>
                    {activeInstance.status === 'starting'
                      ? (activeInstance.gameType === 'valheim'
                          ? VALHEIM_STARTING_MESSAGES[valheimMsgIndex]
                          : (activeInstance.loadingMessage || "Iniciando servidor de Bedrock..."))
                      : s.label}
                  </span>
                  {activeInstance.status === 'online' && (
                    <span className="text-moon-text/50">
                      • {activeInstance.playersConnected} jugadores en línea
                      {activeInstance.runningVersion && (
                        <> • versión {activeInstance.runningVersion}</>
                      )}
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
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-bold transition-all flex items-center gap-2 text-xs uppercase tracking-wider shadow-md shadow-emerald-600/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Play size={14} />
                  <span>Encender</span>
                </button>
              )}

              {activeInstance.status === 'online' && (
                <>
                  <button
                    onClick={() => handleLifecycleAction('stop')}
                    disabled={busy}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg font-bold transition-all flex items-center gap-2 text-xs uppercase tracking-wider shadow-md shadow-rose-600/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Square size={14} />
                    <span>Apagar</span>
                  </button>

                  <button
                    onClick={() => handleLifecycleAction('restart')}
                    disabled={busy}
                    className="px-5 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg font-bold transition-all flex items-center gap-2 text-xs uppercase tracking-wider shadow-md shadow-amber-600/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Reiniciar</span>
                  </button>
                </>
              )}

              {['starting', 'stopping'].includes(activeInstance.status) && (
                <button disabled className="px-5 py-3 bg-moon-card border border-moon-border text-slate-500 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 animate-pulse cursor-not-allowed">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>En transición...</span>
                </button>
              )}

              {activeInstance.status === 'offline' && activeInstance.userRole === 'owner' && (
                <button
                  onClick={handleResetWorld}
                  disabled={busy}
                  className="px-5 py-3 bg-transparent hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                  title="Borrar archivos de guardado y generar un mundo nuevo"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer Mundo</span>
                </button>
              )}
            </div>
          </div>

          {/* Connection Info Card */}
          {activeInstance.status === 'online' && (
            <div className="bg-moon-surface border border-moon-border/85 rounded-xl p-6 shadow-xl">
              <h4 className="text-sm font-bold text-white font-sans mb-4 flex items-center gap-2">
                <Gamepad2 size={16} className="text-moon-accent" />
                <span>Información de Conexión</span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
                <div className="bg-moon-card border border-moon-border/40 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-moon-text/50 uppercase font-bold tracking-wider block mb-0.5">Dirección / IP</span>
                    <span className="text-white font-bold">{activeInstance.gameType === 'valheim' ? 'vh.moondev.online' : 'mc.moondev.online'}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(activeInstance.gameType === 'valheim' ? 'vh.moondev.online' : 'mc.moondev.online', 'ip')}
                    className="p-2 hover:bg-moon-border text-moon-text/60 hover:text-white rounded-lg transition-all"
                    title="Copiar dirección"
                  >
                    {copiedField === 'ip' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="bg-moon-card border border-moon-border/40 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-moon-text/50 uppercase font-bold tracking-wider block mb-0.5">Puerto de Conexión</span>
                    <span className="text-white font-bold">{activeInstance.queryPort}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(String(activeInstance.queryPort), 'port')}
                    className="p-2 hover:bg-moon-border text-moon-text/60 hover:text-white rounded-lg transition-all"
                    title="Copiar puerto"
                  >
                    {copiedField === 'port' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {activeInstance.gameType === 'valheim' && (
                <div className="mt-4 p-3 bg-moon-card/45 border border-moon-border/30 rounded-lg text-xs text-moon-text/70 leading-relaxed font-sans">
                  <span className="font-semibold text-white">Instrucciones para Valheim:</span> En Steam, ve a <strong>Ver &rarr; Servidores &rarr; Favoritos</strong>, añade <code>vh.moondev.online:{activeInstance.queryPort}</code> y haz clic en conectar.
                </div>
              )}
              {activeInstance.gameType === 'minecraft' && (
                <div className="mt-4 p-3 bg-moon-card/45 border border-moon-border/30 rounded-lg text-xs text-moon-text/70 leading-relaxed font-sans">
                  <span className="font-semibold text-white">Instrucciones para Minecraft Bedrock:</span> En el juego, ve a la pestaña <strong>Servidores</strong>, haz clic en <strong>Añadir Servidor</strong>, introduce la dirección <code>mc.moondev.online</code> y el puerto <code>{activeInstance.queryPort}</code>.
                </div>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 select-none">
            <div className="bg-moon-surface/40 border border-blue-500/10 p-5 rounded-xl flex items-center gap-4 hover:border-blue-500/25 transition-all shadow-[0_0_10px_rgba(37,99,235,0.02)] hover:shadow-[0_0_15px_rgba(37,99,235,0.08)] cursor-default">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Cpu size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-slate-500 uppercase font-bold font-sans tracking-widest">CPU LOAD</p>
                <p className="text-xl font-bold text-white mt-1">{stats.cpu}%</p>
              </div>
            </div>

            <div className="bg-moon-surface/40 border border-emerald-500/10 p-5 rounded-xl flex items-center gap-4 hover:border-emerald-500/25 transition-all shadow-[0_0_10px_rgba(34,197,94,0.02)] hover:shadow-[0_0_15px_rgba(34,197,94,0.08)] cursor-default">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <HardDrive size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-slate-500 uppercase font-bold font-sans tracking-widest">RAM USAGE</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats.ramUsed} MB <span className="text-xs text-slate-500 font-normal">/ {stats.ramLimit || '512'} MB</span>
                </p>
              </div>
            </div>

            <div className="bg-moon-surface/40 border border-fuchsia-500/10 p-5 rounded-xl flex items-center gap-4 hover:border-fuchsia-500/25 transition-all shadow-[0_0_10px_rgba(217,70,239,0.02)] hover:shadow-[0_0_15px_rgba(217,70,239,0.08)] cursor-default">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0">
                <HardDrive size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-slate-500 uppercase font-bold font-sans tracking-widest">STORAGE</p>
                <p className="text-xl font-bold text-white mt-1">
                  {stats.diskUsed} MB <span className="text-xs text-slate-500 font-normal">usados</span>
                </p>
              </div>
            </div>

            <div className="bg-moon-surface/40 border border-cyan-500/10 p-5 rounded-xl flex items-center gap-4 hover:border-cyan-500/25 transition-all shadow-[0_0_10px_rgba(6,182,212,0.02)] hover:shadow-[0_0_15px_rgba(6,182,212,0.08)] cursor-default">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
              <div className="font-mono">
                <p className="text-[10px] text-slate-500 uppercase font-bold font-sans tracking-widest">JUGADORES</p>
                <p className="text-xl font-bold text-white mt-1 font-mono">
                  {activeInstance.status === 'online' ? activeInstance.playersConnected : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Consola & Logs interactivos */}
          {(activeInstance.gameType === 'minecraft' || activeInstance.gameType === 'valheim') && (
            <div className="bg-moon-surface border border-moon-border rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-moon-accent" />
                  <h4 className="text-sm font-bold text-white font-sans">Consola y Registros</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-moon-text/50">Actualizado en tiempo real</span>
                  <button 
                    onClick={fetchLogs}
                    className="p-1.5 hover:bg-moon-card text-moon-text/70 hover:text-white rounded transition-colors"
                    title="Actualizar bitácora"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              {/* Terminal Logs Area */}
              <div className="bg-black/95 border border-blue-500/15 rounded-lg p-4 h-64 overflow-y-auto font-mono text-[11px] text-emerald-400/90 space-y-1 select-text scrollbar-thin shadow-[inset_0_0_12px_rgba(0,0,0,0.8)]">
                {activeInstance.status !== 'online' && logs.length === 0 ? (
                  <div className="text-slate-500 italic py-12 text-center font-mono">
                    [SYSTEM] EL SERVIDOR ESTÁ INACTIVO. ENCIENDA PARA CARGAR REGISTROS.
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-slate-500 italic py-12 text-center flex flex-col items-center gap-2 font-mono">
                    <RefreshCw size={16} className="animate-spin text-blue-500" />
                    <span>[SYSTEM] CONECTANDO CON EL CONTENEDOR DOCKER...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap leading-relaxed font-mono">{logs}</pre>
                )}
                <div ref={consoleEndRef} />
              </div>

              {/* Input Command Box */}
              {activeInstance.gameType === 'minecraft' ? (
                activeInstance.status === 'online' && activeInstance.userRole === 'owner' ? (
                  <form onSubmit={handleSendCommand} className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-moon-text/40 font-bold">&gt;</span>
                      <input
                        type="text"
                        placeholder="Escribe un comando de Minecraft (ej. list, op username, say mensaje...)"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-black/50 border border-moon-border/50 focus:border-moon-accent rounded-lg font-mono text-xs text-white focus:outline-none transition-colors"
                        disabled={consoleExecuting}
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-moon-accent hover:bg-moon-hover text-white rounded-lg font-sans text-xs font-semibold shadow-md transition-colors"
                      disabled={consoleExecuting || !commandInput.trim()}
                    >
                      Enviar
                    </button>
                  </form>
                ) : activeInstance.status === 'online' ? (
                  <div className="p-3 bg-moon-card/30 border border-moon-border/30 rounded-lg text-[10px] text-moon-text/40 font-mono">
                    Solo el propietario (owner) del servidor puede enviar comandos directos a la consola.
                  </div>
                ) : null
              ) : (
                <div className="p-3 bg-moon-card/30 border border-moon-border/40 text-moon-text/50 rounded-lg text-[10px] leading-relaxed font-mono">
                  La consola de Valheim es de solo lectura (registros de ejecución). No admite envío de comandos directos.
                </div>
              )}
            </div>
          )}

          {/* Auto-sleep Alert Banner */}
          {activeInstance.status === 'online' && (
            <div className="p-4 bg-moon-card border border-moon-border/80 rounded-xl flex items-start gap-3 text-xs leading-relaxed max-w-2xl font-mono">
              <Info size={16} className="text-moon-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white font-sans text-sm mb-0.5">Auto-Suspensión Activa (Auto-Sleep)</p>
                <p className="text-moon-text/60">
                  Para conservar recursos de la infraestructura, el servidor se apagará automáticamente si se detectan **0 jugadores conectados durante 5 minutos consecutivos**.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: OPTIONS */}
      {activeTab === 'options' && activeInstance && (
        <div className="bg-moon-surface border border-moon-border rounded-xl p-6 md:p-8 w-full max-w-6xl shadow-xl">
          <div className="mb-6 flex items-start gap-3">
            <Settings size={22} className="text-moon-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold font-sans">Opciones de Configuración</h3>
              <p className="text-xs text-moon-text/50 font-mono mt-0.5">Edita las opciones principales. Guardar cambios requerirá detener/recrear el contenedor.</p>
            </div>
          </div>

          {configLoading ? (
            <div className="p-12 text-center text-moon-text/40 font-mono flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-moon-accent" />
              <span>Cargando configuraciones...</span>
            </div>
          ) : activeInstance.gameType === 'valheim' ? (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Nombre del Servidor</label>
                <input
                  type="text"
                  required
                  value={configData.SERVER_NAME || ''}
                  onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_NAME: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all font-sans font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Nombre del Mundo</label>
                <input
                  type="text"
                  required
                  value={configData.WORLD_NAME || ''}
                  onChange={(e) => setConfigData(prev => ({ ...prev, WORLD_NAME: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Contraseña de Entrada</label>
                  <input
                    type="text"
                    required
                    value={configData.SERVER_PASS || ''}
                    onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_PASS: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all font-mono font-semibold tracking-wider"
                  />
                  <p className="text-[10px] text-moon-text/45 font-mono">Mínimo 5 caracteres.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Servidor Público</label>
                  <select
                    value={configData.SERVER_PUBLIC || 'false'}
                    onChange={(e) => setConfigData(prev => ({ ...prev, SERVER_PUBLIC: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all font-mono"
                  >
                    <option value="true">Sí (Aparece en buscador)</option>
                    <option value="false">No (Conexión directa)</option>
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Rama de Steam (Versión)</label>
                  <select
                    value={configData.VALHEIM_BRANCH || 'public'}
                    onChange={(e) => setConfigData(prev => ({ ...prev, VALHEIM_BRANCH: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none transition-all font-mono"
                  >
                    <option value="public">Pública / Estable (public)</option>
                    <option value="public-test">Pública de Pruebas / Beta (public-test)</option>
                  </select>
                  <p className="text-[10px] text-moon-text/45 font-mono">
                    El servidor de Valheim se actualiza automáticamente a través de SteamCMD al iniciar/reiniciar. Cambiar la rama requiere recrear el contenedor.
                  </p>
                </div>
              </div>

              {/* Modificadores de Mundo */}
              <div className="border-t border-moon-border/40 pt-5 space-y-5">
                <div>
                  <h4 className="text-xs font-bold font-sans text-moon-text/80 uppercase tracking-wider">Modificadores de Mundo</h4>
                  <p className="text-[10px] text-moon-text/50 font-mono mt-0.5">Configura las reglas oficiales del mundo de Valheim (Dificultad, asaltos, combate y portales).</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Preajustes */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Preajuste de Dificultad</label>
                    <select
                      value={configData.preset || 'default'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, preset: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono"
                    >
                      <option value="default">Por Defecto / Normal</option>
                      <option value="casual">Casual (Fácil + Retención de items)</option>
                      <option value="easy">Fácil</option>
                      <option value="hard">Difícil</option>
                      <option value="hardcore">Extremo (Muerte permanente de personaje)</option>
                      <option value="immersive">Inmersivo (Sin mapa ni portales)</option>
                      <option value="hammer">Martillo (Construcción libre y pasivo)</option>
                    </select>
                  </div>

                  {/* Combate */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Dificultad de Combate</label>
                    <select
                      value={configData.combat || 'normal'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, combat: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono"
                    >
                      <option value="veryeasy">Muy Fácil</option>
                      <option value="easy">Fácil</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Difícil</option>
                      <option value="veryhard">Muy Difícil</option>
                    </select>
                  </div>

                  {/* Penalización por muerte */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Penalización por Muerte</label>
                    <select
                      value={configData.deathpenalty || 'normal'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, deathpenalty: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono"
                    >
                      <option value="casual">Casual (No pierdes equipo)</option>
                      <option value="veryeasy">Muy Fácil</option>
                      <option value="easy">Fácil</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Difícil</option>
                      <option value="hardcore">Extremo (Borra personaje al morir)</option>
                    </select>
                  </div>

                  {/* Recursos */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Obtención de Recursos</label>
                    <select
                      value={configData.resources || 'normal'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, resources: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono"
                    >
                      <option value="muchless">Mucho menos (x0.25)</option>
                      <option value="less">Menos (x0.5)</option>
                      <option value="normal">Normal (x1.0)</option>
                      <option value="more">Más (x1.5)</option>
                      <option value="muchmore">Mucho más (x2.0)</option>
                      <option value="most">Máximo (x3.0)</option>
                    </select>
                  </div>

                  {/* Asaltos */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Frecuencia de Asaltos</label>
                    <select
                      value={configData.raids || 'normal'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, raids: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono"
                    >
                      <option value="none">Ninguno (Desactivados)</option>
                      <option value="muchless">Muy Raros</option>
                      <option value="less">Poco Frecuentes</option>
                      <option value="normal">Normal</option>
                      <option value="more">Frecuentes</option>
                      <option value="muchmore">Muy Frecuentes</option>
                    </select>
                  </div>

                  {/* Portales */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Reglas de Portales</label>
                    <select
                      value={configData.portals || 'normal'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, portals: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono"
                    >
                      <option value="casual">Permisivo (Metales permitidos)</option>
                      <option value="normal">Por defecto (No metales)</option>
                      <option value="hard">Restringido (Sin portales comunes)</option>
                      <option value="veryhard">Extremo (Sin portales)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-moon-border/40 space-y-4">
                  <h5 className="text-[11px] font-bold font-sans text-moon-text/70 uppercase tracking-wider">Activadores y Ajustes Adicionales</h5>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {/* Piezas sin coste */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white block">Piezas sin coste</span>
                        <span className="text-[10px] text-moon-text/50 font-mono">nobuildcost</span>
                      </div>
                      <select
                        value={configData.nobuildcost === true || configData.nobuildcost === 'true' ? 'true' : 'false'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, nobuildcost: e.target.value === 'true' }))}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Activado</option>
                        <option value="false">Desactivado</option>
                      </select>
                    </div>

                    {/* Asaltos según jugador */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white block">Asaltos según jugador</span>
                        <span className="text-[10px] text-moon-text/50 font-mono">playerevents</span>
                      </div>
                      <select
                        value={configData.playerevents === true || configData.playerevents === 'true' ? 'true' : 'false'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, playerevents: e.target.value === 'true' }))}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Activado</option>
                        <option value="false">Desactivado</option>
                      </select>
                    </div>

                    {/* Peligros de incendio */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white block">Peligros de incendio</span>
                        <span className="text-[10px] text-moon-text/50 font-mono">firehazards</span>
                      </div>
                      <select
                        value={configData.firehazards === true || configData.firehazards === 'true' ? 'true' : 'false'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, firehazards: e.target.value === 'true' }))}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Activado</option>
                        <option value="false">Desactivado</option>
                      </select>
                    </div>

                    {/* Enemigos pasivos */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white block">Enemigos pasivos</span>
                        <span className="text-[10px] text-moon-text/50 font-mono">passivemobs</span>
                      </div>
                      <select
                        value={configData.passivemobs === true || configData.passivemobs === 'true' ? 'true' : 'false'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, passivemobs: e.target.value === 'true' }))}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Activado</option>
                        <option value="false">Desactivado</option>
                      </select>
                    </div>

                    {/* Sin mapa */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-white block">Sin mapa</span>
                        <span className="text-[10px] text-moon-text/50 font-mono">nomap</span>
                      </div>
                      <select
                        value={configData.nomap === true || configData.nomap === 'true' ? 'true' : 'false'}
                        onChange={(e) => setConfigData(prev => ({ ...prev, nomap: e.target.value === 'true' }))}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Activado</option>
                        <option value="false">Desactivado</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {activeInstance.userRole === 'owner' ? (
                <div className="pt-4 border-t border-moon-border/40 flex justify-end gap-3 font-sans items-center">
                  {configSaved && (
                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 font-mono animate-fadeIn">
                      <Check size={14} />
                      <span>Configuración guardada</span>
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="px-5 py-2.5 bg-moon-accent hover:bg-moon-hover text-white rounded-lg text-sm font-semibold shadow-lg shadow-moon-accent/15 transition-all flex items-center gap-1.5"
                  >
                    {configSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar y Aplicar'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-moon-card border border-moon-border/40 text-moon-text/50 rounded-lg text-xs leading-relaxed font-mono">
                  Solo el propietario (owner) puede editar configuraciones.
                </div>
              )}
            </form>
          ) : (
            // Contenedor de formularios de Minecraft (Versión + Propiedades)
            <div className="space-y-8 animate-fadeIn">
              {/* Formulario de Versión del Servidor */}
              <form onSubmit={handleSaveMcVersion} className="bg-moon-card/15 border border-moon-border/40 p-5 rounded-xl space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Versión del Servidor (Bedrock)</label>
                    {configData.currentVersion && (
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        Versión: {configData.currentVersion} (versión actual)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={
                        configData.VERSION === 'LATEST' || configData.VERSION === 'PRE_RELEASE'
                          ? configData.VERSION
                          : 'CUSTOM'
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'CUSTOM') {
                          setConfigData(prev => ({ ...prev, VERSION: BEDROCK_VERSIONS[0] }))
                        } else {
                          setConfigData(prev => ({ ...prev, VERSION: val }))
                        }
                      }}
                      disabled={activeInstance.status === 'online'}
                      className="px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono sm:w-1/2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="LATEST">Última Estable (LATEST)</option>
                      <option value="PRE_RELEASE">Pre-Lanzamiento (PRE_RELEASE)</option>
                      <option value="CUSTOM">Versión Personalizada...</option>
                    </select>

                    {(configData.VERSION !== 'LATEST' && configData.VERSION !== 'PRE_RELEASE') && (
                      <select
                        value={configData.VERSION || ''}
                        onChange={(e) => setConfigData(prev => ({ ...prev, VERSION: e.target.value }))}
                        disabled={activeInstance.status === 'online'}
                        className="flex-1 px-4 py-2.5 bg-moon-card border border-moon-border focus:border-moon-accent text-white text-sm rounded-lg focus:outline-none font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>Selecciona una versión...</option>
                        {BEDROCK_VERSIONS.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-[10px] text-moon-text/45 font-mono">
                    Actualizar la versión del servidor reiniciará y recreará el contenedor de Docker para aplicar el cambio (tarda ~15 segundos). Tus mundos y configuraciones no se verán afectados.
                  </p>
                  {activeInstance.status === 'online' && (
                    <p className="text-rose-400 text-[10px] font-bold font-mono animate-pulse">
                      * Debes apagar el servidor primero para poder actualizar o cambiar la versión.
                    </p>
                  )}
                </div>

                {activeInstance.userRole === 'owner' ? (
                  <div className="flex justify-end font-sans items-center gap-3">
                    {mcVersionSaved && (
                      <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 font-mono animate-fadeIn">
                        <Check size={14} />
                        <span>Versión actualizada</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={configSaving || activeInstance.status === 'online'}
                      className="px-4 py-2 bg-moon-accent hover:bg-moon-hover text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:hover:bg-moon-accent disabled:cursor-not-allowed"
                    >
                      {configSaving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Actualizar Versión'}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-moon-card/30 border border-moon-border/40 text-moon-text/50 rounded-lg text-[10px] leading-relaxed font-mono">
                    Solo el propietario (owner) del servidor puede actualizar la versión.
                  </div>
                )}
              </form>

              {/* Formulario Avanzado server.properties (Minecraft Aternos-style) */}
              <div className="space-y-6">
                <div className="flex items-start gap-2.5 p-3.5 bg-moon-card/45 border border-moon-border/40 rounded-xl text-moon-text/70 text-xs font-mono">
                  <Info size={14} className="text-moon-accent shrink-0 mt-0.5" />
                  <span>
                    Las opciones se guardan de manera segura en el archivo <code>server.properties</code> de inmediato. Los cambios en la dificultad se aplican en caliente si el servidor está encendido; los demás cambios requieren reiniciar el servidor.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Slots (max-players) */}
                  <div className="space-y-2 bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Espacios (slots)</label>
                        {savedProperty === 'max-players' && <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>}
                      </div>
                      <span className="text-[9px] text-moon-text/40 font-mono">max-players={mcPropertiesData['max-players'] || '10'}</span>
                    </div>
                    <div className="flex gap-2 items-center mt-2">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={mcPropertiesData['max-players'] || '10'}
                        onChange={(e) => setMcPropertiesData(prev => ({ ...prev, 'max-players': e.target.value }))}
                        disabled={activeInstance.userRole !== 'owner' || savingProperty === 'max-players'}
                        className="flex-1 px-3 py-2 bg-black border border-moon-border/80 focus:border-moon-accent text-white text-xs rounded focus:outline-none font-mono disabled:opacity-40"
                      />
                      {activeInstance.userRole === 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleSaveSingleProperty('max-players', mcPropertiesData['max-players'])}
                          disabled={savingProperty === 'max-players' || mcProperties['max-players'] === mcPropertiesData['max-players']}
                          className="px-3.5 py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-30 text-white rounded text-xs font-semibold font-sans flex items-center justify-center gap-1 cursor-pointer"
                          title="Guardar cambios de espacios"
                        >
                          {savingProperty === 'max-players' ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Modo de Juego (gamemode) */}
                  <div className="space-y-2 bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Modo de juego</label>
                        {mcPropertiesData['gamemode'] === 'creative' && (
                          <div className="text-rose-400 flex items-center gap-0.5" title="El modo creativo desactiva los logros">
                            <ShieldAlert size={12} />
                            <span className="text-[9px] font-mono font-bold uppercase">Desactiva logros</span>
                          </div>
                        )}
                        {savedProperty === 'gamemode' && <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>}
                      </div>
                      <span className="text-[9px] text-moon-text/40 font-mono">gamemode={mcPropertiesData['gamemode'] || 'survival'}</span>
                    </div>
                    <select
                      value={mcPropertiesData['gamemode'] || 'survival'}
                      onChange={(e) => handleSaveSingleProperty('gamemode', e.target.value)}
                      disabled={activeInstance.userRole !== 'owner' || savingProperty === 'gamemode'}
                      className="w-full px-3 py-2 mt-2 bg-black border border-moon-border/80 focus:border-moon-accent text-white text-xs rounded focus:outline-none font-mono disabled:opacity-40"
                    >
                      <option value="survival">Survival</option>
                      <option value="creative">Creative</option>
                      <option value="adventure">Adventure</option>
                      <option value="spectator">Spectator</option>
                    </select>
                  </div>

                  {/* Dificultad (difficulty) */}
                  <div className="space-y-2 bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Dificultad</label>
                        {savedProperty === 'difficulty' && <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>}
                      </div>
                      <span className="text-[9px] text-moon-text/40 font-mono">difficulty={mcPropertiesData['difficulty'] || 'normal'}</span>
                    </div>
                    <select
                      value={mcPropertiesData['difficulty'] || 'normal'}
                      onChange={(e) => handleSaveSingleProperty('difficulty', e.target.value)}
                      disabled={activeInstance.userRole !== 'owner' || savingProperty === 'difficulty'}
                      className="w-full px-3 py-2 mt-2 bg-black border border-moon-border/80 focus:border-moon-accent text-white text-xs rounded focus:outline-none font-mono disabled:opacity-40"
                    >
                      <option value="peaceful">Peaceful</option>
                      <option value="easy">Easy</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  {/* Autenticacion (online-mode) */}
                  <div className="space-y-2 bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Autenticación / Craqueado</label>
                        {savedProperty === 'online-mode' && <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>}
                      </div>
                      <span className="text-[9px] text-moon-text/40 font-mono">online-mode={mcPropertiesData['online-mode'] || 'true'}</span>
                    </div>
                    <select
                      value={mcPropertiesData['online-mode'] || 'true'}
                      onChange={(e) => handleSaveSingleProperty('online-mode', e.target.value)}
                      disabled={activeInstance.userRole !== 'owner' || savingProperty === 'online-mode'}
                      className="w-full px-3 py-2 mt-2 bg-black border border-moon-border/80 focus:border-moon-accent text-white text-xs rounded focus:outline-none font-mono disabled:opacity-40"
                    >
                      <option value="true">Activado (Cuentas Originales Xbox Live)</option>
                      <option value="false">Desactivado (Craqueado - Sin Xbox Live)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-moon-border/40 pt-5 space-y-4">
                  <h4 className="text-xs font-bold font-sans text-moon-text/80 uppercase tracking-wider">Reglas Adicionales (server.properties)</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Permitir trucos (allow-cheats) */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white block">Permitir trucos</span>
                          {mcPropertiesData['allow-cheats'] === 'true' && (
                            <div className="text-rose-400 flex items-center gap-0.5" title="Activar trucos deshabilita logros permanentemente">
                              <ShieldAlert size={12} />
                              <span className="text-[9px] font-mono font-bold uppercase">Desactiva logros</span>
                            </div>
                          )}
                          {savedProperty === 'allow-cheats' && (
                            <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>
                          )}
                        </div>
                        <span className="text-[9px] text-moon-text/50 font-mono">allow-cheats={mcPropertiesData['allow-cheats'] || 'false'}</span>
                      </div>
                      <select
                        value={mcPropertiesData['allow-cheats'] || 'false'}
                        onChange={(e) => handleSaveSingleProperty('allow-cheats', e.target.value)}
                        disabled={activeInstance.userRole !== 'owner' || savingProperty === 'allow-cheats'}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    {/* Forzar modo de juego */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white block">Forzar modo de juego</span>
                          {savedProperty === 'force-gamemode' && (
                            <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>
                          )}
                        </div>
                        <span className="text-[9px] text-moon-text/50 font-mono">force-gamemode={mcPropertiesData['force-gamemode'] || 'false'}</span>
                      </div>
                      <select
                        value={mcPropertiesData['force-gamemode'] || 'false'}
                        onChange={(e) => handleSaveSingleProperty('force-gamemode', e.target.value)}
                        disabled={activeInstance.userRole !== 'owner' || savingProperty === 'force-gamemode'}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    {/* Paquete de recursos obligatorio */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white block">Paquete de recursos</span>
                          {savedProperty === 'texturepack-required' && (
                            <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>
                          )}
                        </div>
                        <span className="text-[9px] text-moon-text/50 font-mono">texturepack-required={mcPropertiesData['texturepack-required'] || 'false'}</span>
                      </div>
                      <select
                        value={mcPropertiesData['texturepack-required'] || 'false'}
                        onChange={(e) => handleSaveSingleProperty('texturepack-required', e.target.value)}
                        disabled={activeInstance.userRole !== 'owner' || savingProperty === 'texturepack-required'}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Requerido</option>
                        <option value="false">Opcional</option>
                      </select>
                    </div>

                    {/* Lista de acceso */}
                    <div className="bg-moon-card/30 border border-moon-border/40 p-3.5 rounded-lg flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white block">Lista de acceso</span>
                          {savedProperty === 'allow-list' && (
                            <span className="text-[10px] text-emerald-400 font-bold font-mono">✓ Guardado (se aplicará al reiniciar)</span>
                          )}
                        </div>
                        <span className="text-[9px] text-moon-text/50 font-mono">allow-list={mcPropertiesData['allow-list'] || 'false'}</span>
                      </div>
                      <select
                        value={mcPropertiesData['allow-list'] || 'false'}
                        onChange={(e) => handleSaveSingleProperty('allow-list', e.target.value)}
                        disabled={activeInstance.userRole !== 'owner' || savingProperty === 'allow-list'}
                        className="bg-black border border-moon-border text-xs rounded p-1 font-mono focus:outline-none focus:border-moon-accent text-white"
                      >
                        <option value="true">Habilitada</option>
                        <option value="false">Deshabilitada</option>
                      </select>
                    </div>
                  </div>
                </div>


              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: FILES */}
      {activeTab === 'files' && activeInstance && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-start gap-3">
            <Folder size={22} className="text-moon-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold font-sans">Explorador de Archivos</h3>
              <p className="text-xs text-moon-text/50 font-mono mt-0.5">Explora el directorio del servidor de juego, visualiza y edita archivos de texto.</p>
            </div>
          </div>

          {editingFile ? (
            // Editor de archivos integrado
            <div className="bg-moon-surface border border-moon-border rounded-xl p-5 shadow-xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-moon-border/45 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-moon-accent" />
                  <span className="text-xs font-bold text-white pr-2">{editingFile.path}</span>
                </div>
                <button 
                  onClick={() => setEditingFile(null)}
                  className="flex items-center gap-1 text-[10px] font-sans px-2.5 py-1.5 border border-moon-border/60 hover:bg-moon-card rounded text-moon-text transition-colors focus:outline-none"
                >
                  <ArrowLeft size={12} />
                  <span>Volver</span>
                </button>
              </div>

              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile(prev => ({ ...prev, content: e.target.value }))}
                className="w-full h-96 p-4 bg-black/60 border border-moon-border/40 focus:border-moon-accent rounded-lg text-xs text-slate-100 font-mono focus:outline-none leading-relaxed resize-y scrollbar-thin focus:ring-1 focus:ring-moon-accent"
              />

              {activeInstance.userRole === 'owner' ? (
                <div className="flex justify-end gap-2 font-sans pt-2 items-center">
                  {fileSaved && (
                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 font-mono animate-fadeIn pr-2">
                      <Check size={14} />
                      <span>Archivo guardado</span>
                    </span>
                  )}
                  <button
                    onClick={() => setEditingFile(null)}
                    className="px-4 py-2 border border-moon-border hover:bg-moon-border/45 text-sm font-semibold rounded-lg text-moon-text hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveFile}
                    disabled={fileSaving}
                    className="px-5 py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center gap-1.5"
                  >
                    {fileSaving ? <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                    <span>Guardar Archivo</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-moon-card/30 border border-moon-border/30 rounded-lg text-[10px] text-moon-text/40">
                  Modo de solo lectura. Solo el propietario (owner) puede guardar archivos.
                </div>
              )}
            </div>
          ) : (
            // Lista de archivos del explorador
            <div className="bg-moon-surface border border-moon-border rounded-xl p-5 shadow-xl font-mono">
              {getBreadcrumbs()}

              {filesLoading ? (
                <div className="p-12 text-center text-moon-text/40 flex flex-col items-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-moon-accent" />
                  <span>Navegando el directorio...</span>
                </div>
              ) : filesList.length === 0 ? (
                <div className="p-12 text-center text-moon-text/40 leading-relaxed italic text-xs">
                  Carpeta vacía o sin archivos editables.
                </div>
              ) : (
                <div className="divide-y divide-moon-border/40">
                  {filesList.map(file => (
                    <div 
                      key={file.name}
                      onClick={() => file.isDir ? fetchFiles(file.relativePath) : handleOpenFile(file)}
                      className="p-3.5 flex items-center justify-between hover:bg-moon-card/30 transition-colors cursor-pointer text-xs group"
                    >
                      <div className="flex items-center gap-3">
                        {file.isDir ? (
                          <Folder size={16} className="text-amber-400 group-hover:scale-105 transition-transform" />
                        ) : (
                          <FileText size={16} className="text-slate-400 group-hover:scale-105 transition-transform" />
                        )}
                        <span className={`font-semibold text-white/90 group-hover:text-white ${file.isDir ? 'text-amber-200' : ''}`}>{file.name}</span>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-moon-text/50">
                        {!file.isDir && <span>{(file.size / 1024).toFixed(1)} KB</span>}
                        <ChevronRight size={12} className="text-moon-text/30 group-hover:text-white/60 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}



      {/* TAB CONTENT: BACKUPS */}
      {activeTab === 'backups' && activeInstance && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
            <div className="flex items-start gap-3">
              <History size={22} className="text-moon-accent shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold font-sans">Respaldos del Servidor</h3>
                <p className="text-xs text-moon-text/50 font-mono mt-0.5">Respaldos comprimidos del directorio de guardado del servidor (saves/worlds).</p>
              </div>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={backupCreating}
              className="px-4 py-2.5 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-lg shadow-moon-accent/20 transition flex items-center gap-1.5 self-start sm:self-auto font-sans"
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
                      <tr key={b.filename} className="hover:bg-moon-card/25 transition">
                        <td className="p-4 font-bold text-white/95 truncate max-w-xs">{b.filename}</td>
                        <td className="p-4">{(b.sizeBytes / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="p-4 text-moon-text/75">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Download */}
                            <a
                              href={`${axios.defaults.baseURL}/api/game/instances/${activeInstance.id}/backups/${b.filename}/download`}
                              onClick={(e) => {
                                e.preventDefault()
                                const token = localStorage.getItem('token')
                                window.open(`${axios.defaults.baseURL}/api/game/instances/${activeInstance.id}/backups/${b.filename}/download?token=${token || ''}`)
                              }}
                              className="p-2 text-moon-text/80 hover:text-white hover:bg-moon-card border border-moon-border/50 rounded transition"
                              title="Descargar archivo"
                            >
                              <Download size={14} />
                            </a>

                            {/* Restore (Only Owner, server must be Offline) */}
                            {activeInstance.userRole === 'owner' && (
                              <button
                                onClick={() => handleRestoreBackup(b.filename)}
                                disabled={activeInstance.status !== 'offline' || backupRestoring !== null}
                                className="px-2.5 py-1.5 bg-yellow-700/80 hover:bg-yellow-600 disabled:opacity-35 text-white font-semibold rounded text-[10px] transition flex items-center gap-1 font-sans"
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
                                className="p-2 text-rose-400 hover:text-white hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 rounded transition"
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

      {/* TAB CONTENT: WORLD SETTINGS (level.dat + gamerules + experiments + management) */}
      {activeTab === 'world-settings' && activeInstance && activeInstance.gameType === 'minecraft' && (
        <div className="space-y-6">

          {/* Server-must-be-offline notice */}
          {activeInstance.status === 'online' && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl text-amber-400 text-sm font-mono">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Servidor encendido</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Las secciones &quot;Administración de Mundo&quot;, &quot;Opciones de level.dat&quot; y &quot;Experimentos&quot; requieren que el servidor esté apagado para guardar cambios. Las gamerules en tiempo real sí se aplican en vivo.
                </p>
              </div>
            </div>
          )}

          {/* ─── SECTION 1: WORLD MANAGEMENT (Upload, Download, Generate, Reset) ─── */}
          <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-moon-border/60 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                <Globe2 size={14} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Administración del Mundo</h3>
                <p className="text-xs text-moon-text/50 font-mono">Carga, descarga, genera o restablece el mundo de juego.</p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Import/Export Card */}
              <div className="space-y-4 bg-moon-card/25 border border-moon-border/40 p-4 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Importar y Exportar</h4>
                  <p className="text-[10px] text-moon-text/50 font-mono mt-0.5">Transfiere el mundo usando archivos ZIP.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleDownloadWorld}
                    className="flex-1 py-2.5 bg-moon-card border border-moon-border/60 hover:bg-moon-border text-white text-xs font-semibold font-sans rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Descargar Mundo (ZIP)</span>
                  </button>

                  {activeInstance.userRole === 'owner' ? (
                    <label className={`flex-1 py-2.5 text-white text-xs font-semibold font-sans rounded-lg transition-colors flex items-center justify-center gap-1.5 text-center shadow-md ${
                      activeInstance.status === 'online'
                        ? 'bg-moon-accent/20 border border-moon-accent/10 opacity-50 cursor-not-allowed'
                        : 'bg-moon-accent hover:bg-moon-hover'
                    }`}>
                      {worldUploading ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                      <span>{worldUploading ? 'Subiendo...' : 'Subir Mundo (ZIP)'}</span>
                      {activeInstance.status !== 'online' && (
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleUploadWorld}
                          disabled={worldUploading}
                          className="hidden"
                        />
                      )}
                    </label>
                  ) : null}
                </div>
                {activeInstance.userRole === 'owner' && (
                  <p className="text-[9px] text-moon-text/40 font-mono italic">
                    * Límite de subida: 100 MB. La subida requiere apagar el servidor.
                  </p>
                )}
              </div>

              {/* Generate/Reset Card */}
              <div className="space-y-4 bg-moon-card/25 border border-moon-border/40 p-4 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Generar / Restablecer Mundo</h4>
                  <p className="text-[10px] text-moon-text/50 font-mono mt-0.5">Crea un mundo limpio o borra todo desde cero.</p>
                </div>

                <form onSubmit={handleGenerateWorld} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[9px] font-semibold text-moon-text/60 font-mono uppercase tracking-wider mb-1">Nombre del Mundo</label>
                      <input
                        type="text"
                        placeholder="Ej: Mi_Mundo"
                        value={newWorldName}
                        onChange={(e) => setNewWorldName(e.target.value)}
                        disabled={activeInstance.status === 'online'}
                        className="w-full px-2.5 py-2 bg-black/40 border border-moon-border/60 text-xs rounded focus:outline-none focus:border-moon-accent font-mono text-white disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-moon-text/60 font-mono uppercase tracking-wider mb-1">Semilla (Seed)</label>
                      <input
                        type="text"
                        placeholder="Semilla (en blanco = aleatoria)"
                        value={newWorldSeed}
                        onChange={(e) => setNewWorldSeed(e.target.value)}
                        disabled={activeInstance.status === 'online'}
                        className="w-full px-2.5 py-2 bg-black/40 border border-moon-border/60 text-xs rounded focus:outline-none focus:border-moon-accent font-mono text-white disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-semibold text-moon-text/60 font-mono uppercase tracking-wider">Dificultad Inicial</label>
                    <select
                      value={newWorldDifficulty}
                      onChange={(e) => setNewWorldDifficulty(e.target.value)}
                      disabled={activeInstance.status === 'online'}
                      className="w-full px-2.5 py-2 bg-black/40 border border-moon-border/60 text-xs rounded focus:outline-none focus:border-moon-accent font-mono text-white disabled:opacity-40"
                    >
                      <option value="peaceful">Pacífico (Peaceful)</option>
                      <option value="easy">Fácil (Easy)</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Difícil (Hard)</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    {activeInstance.userRole === 'owner' ? (
                      <>
                        <button
                          type="submit"
                          disabled={worldGenerating || activeInstance.status === 'online'}
                          className="flex-1 py-2.5 bg-rose-700/70 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-bold font-sans rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                          {worldGenerating ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          <span>Generar Mundo</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResetWorld}
                          disabled={actionLoading || activeInstance.status === 'online'}
                          className="px-3.5 py-2.5 bg-black/30 hover:bg-rose-950/20 border border-rose-900/30 hover:border-rose-900/60 disabled:opacity-40 text-rose-400 text-xs font-semibold font-sans rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="Restablecer mundo por completo"
                        >
                          <Trash2 size={13} />
                          <span>Borrar</span>
                        </button>
                      </>
                    ) : (
                      <div className="p-2 bg-moon-card/35 border border-moon-border/30 rounded text-[9px] text-moon-text/40 font-mono text-center w-full">
                        Solo el propietario (owner) puede administrar el mundo.
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>

          {worldDataLoading ? (
            <div className="flex items-center gap-3 p-8 justify-center text-moon-text/50 font-mono text-sm">
              <RefreshCw size={16} className="animate-spin" />
              <span>Leyendo level.dat...</span>
            </div>
          ) : (
            <>
              {/* Bloqueo / Advertencia si el mundo no se ha inicializado en disco */}
              {(!worldData || worldData.levelDatExists === false) && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl text-amber-400 text-sm font-mono mb-6 shadow-md">
                  <Lock size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Mundo no inicializado — Configuración deshabilitada</p>
                    <p className="text-amber-400/70 text-xs mt-0.5 leading-relaxed">
                      El servidor debe encenderse y arrancar completamente al menos una vez para generar el archivo de datos del mundo (<code>level.dat</code>), lo que habilitará los controles del archivo de mundo, las reglas de juego y experimentos.
                    </p>
                  </div>
                </div>
              )}

              {/* ─── SECTION 2: GAMERULES (real-time) ─── */}
              <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-moon-border/60 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center">
                    <Zap size={14} className="text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Reglas de Juego (Tiempo Real)</h3>
                    <p className="text-xs text-moon-text/50 font-mono">Se aplican en caliente de inmediato al jugar.</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
                    <Zap size={10} />
                    TIEMPO REAL
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { rule: 'showcoordinates',   label: 'Mostrar Coordenadas',     desc: 'Muestra XYZ en pantalla', dangerous: false },
                    { rule: 'keepinventory',     label: 'Mantener Inventario',    desc: 'No perder objetos al morir', dangerous: true },
                    { rule: 'pvp',               label: 'PvP',                     desc: 'Combate entre jugadores', dangerous: false },
                    { rule: 'dodaylightcycle',   label: 'Ciclo Día/Noche',         desc: 'Activar ciclo solar', dangerous: true },
                    { rule: 'doweathercycle',    label: 'Ciclo de Clima',          desc: 'Lluvia y tormentas', dangerous: true },
                    { rule: 'domobspawning',     label: 'Spawn de Mobs',           desc: 'Mobs naturales', dangerous: true },
                    { rule: 'dofiretick',        label: 'Propagación de Fuego',    desc: 'El fuego se extiende', dangerous: true },
                    { rule: 'domobloot',         label: 'Loot de Mobs',            desc: 'Drop de items al matar mobs', dangerous: true },
                    { rule: 'naturalregeneration',label: 'Regeneración Natural',   desc: 'Recuperar vida automáticamente', dangerous: true },
                    { rule: 'doinsomnia',        label: 'Phantoms',                desc: 'Spawn de phantoms nocturnos', dangerous: true },
                    { rule: 'mobgriefing',       label: 'Griefing de Mobs',        desc: 'Mobs no dañan bloques', dangerous: true },
                    { rule: 'showdeathmessages', label: 'Mensajes de Muerte',      desc: 'Notificación al morir', dangerous: false },
                  ].map(({ rule, label, desc, dangerous }) => {
                    const isOn = activeGamerules[rule] === true || activeGamerules[rule] === 'true'
                    const worldExists = worldData && worldData.levelDatExists !== false
                    return (
                      <button
                        key={rule}
                        onClick={() => {
                          if (!worldExists) return
                          handleGameruleChange(rule, !isOn)
                        }}
                        disabled={!worldExists}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed ${
                          isOn
                            ? 'bg-moon-accent/8 border-moon-accent/30 hover:border-moon-accent/50'
                            : 'bg-moon-card/40 border-moon-border/50 hover:border-moon-border'
                        } ${worldExists ? 'cursor-pointer' : ''}`}
                      >
                        <div className={`shrink-0 transition-colors ${isOn ? 'text-moon-accent' : 'text-moon-text/30'}`}>
                          {isOn ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-semibold leading-tight ${isOn ? 'text-white' : 'text-moon-text/60'}`}>{label}</p>
                            {dangerous && (
                              <div className="shrink-0 text-amber-500" title="Requiere trucos (Desactiva logros)">
                                <ShieldAlert size={12} />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-moon-text/40 font-mono truncate">{desc}</p>
                          <p className="text-[9px] text-moon-text/45 font-mono mt-1 select-all">{rule}: {isOn ? 'true' : 'false'}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ─── SECTION 3: LEVEL.DAT FIELDS (requires offline) ─── */}
              <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-moon-border/60 flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                    <Globe2 size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Opciones del Archivo de Mundo (level.dat)</h3>
                    <p className="text-xs text-moon-text/50 font-mono">Guardado en level.dat. Requieren reiniciar el servidor.</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                    <Lock size={10} />
                    REINICIO
                  </div>
                </div>
                <form onSubmit={handleSaveWorldData} className="p-6 space-y-5">
                  {worldData && worldData.levelDatExists !== false ? (
                    <>
                      {/* Advertencia si fue cargado en creativo en el pasado */}
                      {worldData.loadedInCreative && (
                        <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/8 border border-rose-500/25 rounded-xl text-rose-400 text-xs font-mono mb-2 leading-relaxed">
                          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold uppercase text-[10px] tracking-wider">Logros Desactivados en este mundo</p>
                            <p className="text-rose-400/85 mt-0.5">
                              Este mundo se ha cargado previamente en modo Creativo (<code>hasBeenLoadedInCreative: true</code>). La obtención de logros de Xbox Live ha sido deshabilitada permanentemente en este nivel.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Seed (read-only) */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Semilla</label>
                          <input
                            type="text"
                            value={worldData.seed ?? '—'}
                            readOnly
                            className="w-full bg-black/20 border border-moon-border/40 rounded-lg px-3 py-2.5 text-xs font-mono text-moon-text/50 cursor-not-allowed select-all"
                          />
                          <p className="text-[9px] text-moon-text/45 font-mono select-all">RandomSeed={worldData.seed ?? '—'}</p>
                        </div>
                        
                        {/* World Name */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Nombre del Mundo</label>
                          <input
                            type="text"
                            value={localLevelDat.LevelName ?? ''}
                            onChange={e => setLocalLevelDat(p => ({ ...p, LevelName: e.target.value }))}
                            disabled={activeInstance.status === 'online'}
                            className="w-full bg-moon-card border border-moon-border rounded-lg px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-moon-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          />
                          <p className="text-[9px] text-moon-text/45 font-mono select-all">LevelName={localLevelDat.LevelName ?? ''}</p>
                        </div>

                        {/* Difficulty */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Dificultad</label>
                          <select
                            value={localLevelDat.Difficulty ?? 2}
                            onChange={e => setLocalLevelDat(p => ({ ...p, Difficulty: parseInt(e.target.value) }))}
                            disabled={activeInstance.status === 'online'}
                            className="w-full bg-moon-card border border-moon-border rounded-lg px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-moon-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <option value={0}>Peaceful</option>
                            <option value={1}>Easy</option>
                            <option value={2}>Normal</option>
                            <option value={3}>Hard</option>
                          </select>
                          <p className="text-[9px] text-moon-text/45 font-mono select-all">Difficulty={localLevelDat.Difficulty ?? 2}</p>
                        </div>

                        {/* Game Type */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider font-mono">Modo de Juego por Defecto</label>
                            {parseInt(localLevelDat.GameType) === 1 && (
                              <div className="text-rose-400 flex items-center gap-0.5" title="Creativo desactiva los logros de los jugadores">
                                <ShieldAlert size={12} />
                                <span className="text-[9px] font-mono font-bold uppercase">Desactiva logros</span>
                              </div>
                            )}
                          </div>
                          <select
                            value={localLevelDat.GameType ?? 0}
                            onChange={e => setLocalLevelDat(p => ({ ...p, GameType: parseInt(e.target.value) }))}
                            disabled={activeInstance.status === 'online'}
                            className="w-full bg-moon-card border border-moon-border rounded-lg px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-moon-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <option value={0}>Survival</option>
                            <option value={1}>Creative</option>
                            <option value={2}>Adventure</option>
                            <option value={3}>Spectator</option>
                          </select>
                          <p className="text-[9px] text-moon-text/45 font-mono select-all">GameType={localLevelDat.GameType ?? 0}</p>
                        </div>
                      </div>

                      {/* Hardcore toggle & new variables */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Modo Hardcore */}
                        <div className="bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex items-center justify-between">
                          <div className="pr-3">
                            <span className="text-xs font-semibold text-white block">Modo Hardcore</span>
                            <span className="text-[9px] text-moon-text/50 font-mono select-all">IsHardcore={localLevelDat.IsHardcore ? 'true' : 'false'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocalLevelDat(p => ({ ...p, IsHardcore: !p.IsHardcore }))}
                            disabled={activeInstance.status === 'online'}
                            className={`shrink-0 transition-colors ${localLevelDat.IsHardcore ? 'text-rose-400' : 'text-moon-text/30'} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {localLevelDat.IsHardcore ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                        </div>

                        {/* Permitir Comandos */}
                        <div className="bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex items-center justify-between">
                          <div className="pr-3">
                            <span className="text-xs font-semibold text-white block">Permitir Comandos</span>
                            <span className="text-[9px] text-moon-text/50 font-mono select-all">commandsEnabled={localLevelDat.commandsEnabled ? 'true' : 'false'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocalLevelDat(p => ({ ...p, commandsEnabled: !p.commandsEnabled }))}
                            disabled={activeInstance.status === 'online'}
                            className={`shrink-0 transition-colors ${localLevelDat.commandsEnabled ? 'text-moon-accent' : 'text-moon-text/30'} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {localLevelDat.commandsEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                        </div>

                        {/* Permitir Trucos */}
                        <div className="bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex items-center justify-between">
                          <div className="pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white block">Permitir Trucos (Mundo)</span>
                              {localLevelDat.cheatsEnabled && (
                                <div className="text-rose-400 flex items-center gap-0.5" title="Activar trucos desactiva logros permanentemente">
                                  <ShieldAlert size={12} />
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] text-moon-text/50 font-mono select-all">cheatsEnabled={localLevelDat.cheatsEnabled ? 'true' : 'false'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocalLevelDat(p => ({ ...p, cheatsEnabled: !p.cheatsEnabled }))}
                            disabled={activeInstance.status === 'online'}
                            className={`shrink-0 transition-colors ${localLevelDat.cheatsEnabled ? 'text-moon-accent' : 'text-moon-text/30'} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {localLevelDat.cheatsEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                        </div>

                        {/* Education Features */}
                        <div className="bg-moon-card/30 border border-moon-border/40 p-4 rounded-xl flex items-center justify-between">
                          <div className="pr-3">
                            <span className="text-xs font-semibold text-white block">Education Features</span>
                            <span className="text-[9px] text-moon-text/50 font-mono select-all">EducationFeatures={localLevelDat.EducationFeatures ? 'true' : 'false'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocalLevelDat(p => ({ ...p, EducationFeatures: !p.EducationFeatures }))}
                            disabled={activeInstance.status === 'online'}
                            className={`shrink-0 transition-colors ${localLevelDat.EducationFeatures ? 'text-moon-accent' : 'text-moon-text/30'} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {localLevelDat.EducationFeatures ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-moon-text/50 font-mono text-center py-6">No se pudo leer el archivo level.dat. Inicia el servidor al menos una vez.</p>
                  )}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={activeInstance.status === 'online' || worldDataSaving || !worldData || worldData.levelDatExists === false}
                      className="flex items-center gap-2 px-5 py-2.5 bg-moon-accent hover:bg-moon-accent/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all cursor-pointer"
                    >
                      {worldDataSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      <span>Guardar Opciones de Mundo</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* ─── SECTION 4: EXPERIMENTS (requires offline) ─── */}
              <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-moon-border/60 flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center">
                    <FlaskConical size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Experimentos</h3>
                    <p className="text-xs text-moon-text/50 font-mono">Funciones experimentales del servidor. Requieren reinicio.</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                    <Lock size={10} />
                    REINICIO
                  </div>
                </div>
                <form onSubmit={handleSaveExperiments} className="p-6">
                  {/* General experiments achievement warning */}
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-mono mb-4 leading-relaxed">
                    <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                    <span>Advertencia: Activar cualquier experimento en Minecraft Bedrock deshabilitará la obtención de logros de manera permanente en este mundo.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    {[
                      { key: 'gametest',                     label: 'Beta APIs',                          desc: 'Requerido para add-ons con scripts' },
                      { key: 'upcoming_creator_features',    label: 'Upcoming Creator Features',          desc: 'Funciones del creador en prueba' },
                      { key: 'experimental_creator_cameras', label: 'Creator Camera Experimental',       desc: 'Cámara para creadores de contenido' },
                      { key: 'villager_trades_rebalance',    label: 'Reequilibrio de Tratos Aldeanos',    desc: 'Ajuste económico de aldeanos' },
                      { key: 'data_driven_biomes',           label: 'Custom Biomes',                     desc: 'Biomas personalizados por datos' },
                      { key: 'scripting',                    label: 'Scripting',                         desc: 'API de scripting del servidor' },
                    ].map(({ key, label, desc }) => {
                      const isOn = !!localExperiments[key]
                      const worldExists = worldData && worldData.levelDatExists !== false
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (activeInstance.status === 'online' || !worldExists) return
                            setLocalExperiments(p => ({ ...p, [key]: !p[key] }))
                          }}
                          disabled={activeInstance.status === 'online' || !worldExists}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left disabled:cursor-not-allowed ${
                            isOn
                              ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
                              : 'bg-moon-card/40 border-moon-border/50 hover:border-moon-border'
                          } ${activeInstance.status !== 'online' && worldExists ? 'cursor-pointer' : ''}`}
                        >
                          <div className={`shrink-0 transition-colors ${isOn ? 'text-purple-400' : 'text-moon-text/30'}`}>
                            {isOn ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-tight ${isOn ? 'text-white' : 'text-moon-text/60'}`}>{label}</p>
                            <p className="text-[10px] text-moon-text/40 font-mono truncate">{desc}</p>
                            <p className="text-[9px] text-moon-text/45 font-mono mt-1 select-all">{key}: {isOn ? 'true' : 'false'}</p>
                          </div>
                          {key === 'gametest' && isOn && (
                            <div className="ml-auto shrink-0 text-[9px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5">SCRIPTS</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {localExperiments.gametest && (
                    <div className="flex items-start gap-2 p-3 bg-purple-500/8 border border-purple-500/20 rounded-lg text-purple-400/80 text-xs font-mono mb-4">
                      <Info size={13} className="shrink-0 mt-0.5" />
                      <span>Beta APIs activadas. Los add-ons con scripts (como WAILA, Farmers Delight, etc.) requieren esta opción.</span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={activeInstance.status === 'online' || experimentsSaving || !worldData || worldData.levelDatExists === false}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all cursor-pointer"
                    >
                      {experimentsSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      <span>Guardar Experimentos</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: ADD-ONS */}
      {activeTab === 'addons' && activeInstance && activeInstance.gameType === 'minecraft' && (
        <div className="space-y-6">
          {/* Read-only banner when server is online */}
          {activeInstance.status === 'online' && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl text-amber-400 text-sm font-mono">
              <Lock size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Servidor encendido — Modo de solo lectura</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Puedes ver los add-ons instalados. Para instalar, activar o desinstalar, apaga el servidor primero.
                </p>
              </div>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          {activeInstance.status !== 'online' && (
            <div
              onDragOver={e => { e.preventDefault(); setAddonDragOver(true) }}
              onDragLeave={() => setAddonDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setAddonDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handleAddonUpload(file)
              }}
              className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-all ${
                addonDragOver
                  ? 'border-moon-accent bg-moon-accent/8 scale-[1.01]'
                  : 'border-moon-border/40 bg-moon-surface/40 hover:border-moon-border'
              }`}
            >
              {addonUploading ? (
                <>
                  <RefreshCw size={28} className="text-moon-accent animate-spin" />
                  <p className="text-sm font-semibold text-white">Instalando add-on...</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 bg-moon-accent/10 border border-moon-accent/20 rounded-2xl flex items-center justify-center">
                    <UploadCloud size={24} className="text-moon-accent" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">Arrastra un add-on aqui o</p>
                    <p className="text-xs text-moon-text/50 font-mono mt-1">.mcpack  .mcaddon  .zip</p>
                  </div>
                  <label className="cursor-pointer px-4 py-2 bg-moon-accent hover:bg-moon-accent/80 text-white text-xs font-bold rounded-lg transition-all">
                    Seleccionar Archivo
                    <input
                      type="file"
                      accept=".mcpack,.mcaddon,.zip"
                      className="hidden"
                      onChange={e => { if (e.target.files[0]) handleAddonUpload(e.target.files[0]); e.target.value = '' }}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {/* Addons Grid */}
          {addonsLoading ? (
            <div className="flex items-center gap-3 p-8 justify-center text-moon-text/50 font-mono text-sm">
              <RefreshCw size={16} className="animate-spin" />
              <span>Cargando add-ons...</span>
            </div>
          ) : addons.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center bg-moon-surface border border-moon-border rounded-xl">
              <div className="w-12 h-12 bg-moon-card border border-moon-border rounded-xl flex items-center justify-center">
                <Package size={20} className="text-moon-text/30" />
              </div>
              <p className="text-sm font-semibold text-white">Sin Add-ons Instalados</p>
              <p className="text-xs text-moon-text/50 font-mono max-w-xs">
                Sube un archivo .mcpack, .mcaddon o .zip para instalar mods, packs de recursos o comportamientos.
              </p>
            </div>
          ) : (
            <>
              {/* Behavior Packs */}
              {addons.filter(a => a.packType === 'behavior').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <h3 className="text-xs font-bold text-moon-text/60 uppercase tracking-wider font-mono">Behavior Packs ({addons.filter(a => a.packType === 'behavior').length})</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {addons.filter(a => a.packType === 'behavior').map(addon => (
                      <div key={addon.uuid} className={`bg-moon-surface border rounded-xl p-4 flex flex-col gap-3 transition-all ${addon.active ? 'border-blue-500/30' : 'border-moon-border/50'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${addon.active ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-moon-card border-moon-border text-moon-text/30'}`}>
                            <Package size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white leading-tight truncate">{addon.name}</p>
                            <p className="text-[10px] text-moon-text/40 font-mono truncate">{addon.description || 'Sin descripcion'}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">BP</span>
                              {addon.requiresBetaApi && (
                                <span className="text-[9px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5">SCRIPTS</span>
                              )}
                              {addon.active && (
                                <span className="text-[9px] font-mono font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">ACTIVO</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-moon-border/30">
                          <button
                            onClick={() => handleAddonToggle(addon)}
                            disabled={activeInstance.status === 'online' || addonActivating === addon.uuid}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              addon.active
                                ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20'
                                : 'bg-moon-card text-moon-text/60 hover:text-white border border-moon-border hover:border-moon-border/70'
                            }`}
                          >
                            {addonActivating === addon.uuid ? <RefreshCw size={12} className="animate-spin" /> : (addon.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />)}
                            {addon.active ? 'Activo' : 'Inactivo'}
                          </button>
                          <button
                            onClick={() => handleAddonUninstall(addon)}
                            disabled={activeInstance.status === 'online' || addonDeleting === addon.uuid}
                            className="p-1.5 text-rose-400/60 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Desinstalar"
                          >
                            {addonDeleting === addon.uuid ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resource Packs */}
              {addons.filter(a => a.packType === 'resource').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <h3 className="text-xs font-bold text-moon-text/60 uppercase tracking-wider font-mono">Resource Packs ({addons.filter(a => a.packType === 'resource').length})</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {addons.filter(a => a.packType === 'resource').map(addon => (
                      <div key={addon.uuid} className={`bg-moon-surface border rounded-xl p-4 flex flex-col gap-3 transition-all ${addon.active ? 'border-green-500/30' : 'border-moon-border/50'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${addon.active ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-moon-card border-moon-border text-moon-text/30'}`}>
                            <Sparkles size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white leading-tight truncate">{addon.name}</p>
                            <p className="text-[10px] text-moon-text/40 font-mono truncate">{addon.description || 'Sin descripcion'}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="text-[9px] font-mono font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">RP</span>
                              {addon.active && (
                                <span className="text-[9px] font-mono font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">ACTIVO</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-moon-border/30">
                          <button
                            onClick={() => handleAddonToggle(addon)}
                            disabled={activeInstance.status === 'online' || addonActivating === addon.uuid}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              addon.active
                                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                                : 'bg-moon-card text-moon-text/60 hover:text-white border border-moon-border hover:border-moon-border/70'
                            }`}
                          >
                            {addonActivating === addon.uuid ? <RefreshCw size={12} className="animate-spin" /> : (addon.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />)}
                            {addon.active ? 'Activo' : 'Inactivo'}
                          </button>
                          <button
                            onClick={() => handleAddonUninstall(addon)}
                            disabled={activeInstance.status === 'online' || addonDeleting === addon.uuid}
                            className="p-1.5 text-rose-400/60 hover:text-rose-400 border border-transparent hover:border-rose-500/20 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Desinstalar"
                          >
                            {addonDeleting === addon.uuid ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {/* Experiments Panel */}
          {worldData && worldData.levelDatExists !== false && (
            <form onSubmit={handleSaveExperiments} className="bg-moon-surface border border-moon-border rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-sans">Experimentos del Mundo</h3>
                  <p className="text-[11px] text-moon-text/50 font-mono mt-0.5">
                    Configuracion en <code>level.dat</code>. Requiere servidor apagado. Algunos add-ons con scripts los necesitan.
                  </p>
                </div>
                {experimentsSaving && <RefreshCw size={14} className="text-moon-accent animate-spin shrink-0 mt-1" />}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/6 border border-amber-500/20 rounded-lg">
                <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-400/80 font-mono leading-relaxed">
                  Activar experimentos puede deshabilitar los logros del mundo. Solo activa los que tu add-on requiera.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    key: 'scripting',
                    label: 'Beta APIs',
                    description: 'Requerido para add-ons con scripting (@minecraft/server)',
                    required: true
                  },
                  {
                    key: 'upcoming_creator_features',
                    label: 'Upcoming Creator Features',
                    description: 'Bloques y entidades personalizadas avanzadas'
                  },
                  {
                    key: 'experimental_creator_cameras',
                    label: 'Creator Cameras',
                    description: 'API de camaras para secuencias cinematicas'
                  },
                  {
                    key: 'gametest',
                    label: 'GameTest Framework',
                    description: 'Framework de pruebas automatizadas para packs'
                  },
                  {
                    key: 'data_driven_biomes',
                    label: 'Data-Driven Biomes',
                    description: 'Biomas completamente personalizados via packs'
                  }
                ].map(({ key, label, description, required }) => {
                  const isOn = !!localExperiments[key]
                  const isOffline = activeInstance.status !== 'online'
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!isOffline}
                      onClick={() => isOffline && setLocalExperiments(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`flex items-start gap-3 p-3.5 rounded-lg border text-left transition-all ${
                        isOn
                          ? 'bg-moon-accent/8 border-moon-accent/30'
                          : 'bg-moon-card/30 border-moon-border/50 hover:border-moon-border'
                      } ${!isOffline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                        isOn
                          ? 'bg-moon-accent/15 border-moon-accent/30 text-moon-accent'
                          : 'bg-moon-surface border-moon-border text-moon-text/30'
                      }`}>
                        <FlaskConical size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{label}</span>
                          {required && (
                            <span className="text-[8px] font-mono font-bold text-moon-accent bg-moon-accent/10 border border-moon-accent/20 rounded-full px-1.5 py-0.5">
                              PRINCIPAL
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-moon-text/45 font-mono mt-0.5 leading-relaxed">{description}</p>
                        <p className="text-[9px] font-mono font-bold mt-1.5 tracking-wider ${
                          isOn ? 'text-moon-accent' : 'text-moon-text/30'
                        }">{isOn ? 'ACTIVO' : 'INACTIVO'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {activeInstance.status !== 'online' && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={experimentsSaving}
                    className="px-4 py-2 bg-moon-accent hover:bg-moon-hover text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed font-sans"
                  >
                    {experimentsSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar Experimentos
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ACCIONES UNIFICADO (ESTILO CYBERPUNK) */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`w-full max-w-md bg-moon-surface border ${confirmModal.isDestructive ? 'border-rose-500/30 shadow-rose-500/5' : 'border-moon-accent/30 shadow-moon-accent/5'} rounded-2xl p-6 shadow-2xl space-y-4 relative overflow-hidden`}>
            {/* Línea decorativa superior */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${confirmModal.isDestructive ? 'from-rose-600 to-amber-500' : 'from-moon-accent to-blue-500'}`} />
            
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${confirmModal.isDestructive ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-moon-accent/10 border-moon-accent/20 text-moon-accent'}`}>
                <AlertTriangle size={24} className={confirmModal.isDestructive ? 'animate-pulse' : ''} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-sans">{confirmModal.title}</h4>
                <p className="text-xs text-moon-text/60 font-mono mt-2 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setConfirmModal(p => ({ ...p, show: false }))}
                className="px-4 py-2 bg-moon-card hover:bg-moon-card/80 border border-moon-border hover:border-moon-border/80 text-moon-text/70 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const callback = confirmModal.onConfirm
                  setConfirmModal(p => ({ ...p, show: false }))
                  if (callback) callback()
                }}
                className={`px-4 py-2 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/15'
                    : 'bg-moon-accent hover:bg-moon-accent/80 shadow-moon-accent/15'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
