import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Server, Users, HardDrive, Cpu, Plus, RefreshCw, ExternalLink, Activity, MessageSquare } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import InstanceCard from '../../components/InstanceCard'
import api from '../../api/axios'

export default function Dashboard() {
  const [instances, setInstances] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recreatingDiscord, setRecreatingDiscord] = useState(false)
  const [discordMessage, setDiscordMessage] = useState('')

  const handleRecreateDiscord = async () => {
    setRecreatingDiscord(true)
    setDiscordMessage('')
    try {
      const res = await api.post('/api/admin/discord/recreate')
      setDiscordMessage('🟢 ' + (res.data.message || 'Tableros recreados exitosamente.'))
      setTimeout(() => setDiscordMessage(''), 4000)
    } catch (error) {
      console.error('[DISCORD RECREATE ERROR]:', error)
      const errMsg = error.response?.data?.error || 'Error al recrear tableros.'
      setDiscordMessage('❌ ' + errMsg)
      setTimeout(() => setDiscordMessage(''), 5000)
    } finally {
      setRecreatingDiscord(false)
    }
  }

  const fetchData = async () => {
    try {
      const [instancesRes, clientsRes] = await Promise.all([
        api.get('/api/admin/instances'),
        api.get('/api/admin/clients')
      ])
      setInstances(instancesRes.data)
      setClients(clientsRes.data)
    } catch (error) {
      console.error('[DASHBOARD ERROR] Error al cargar datos:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleStatusChange = (instanceId, newStatus) => {
    setInstances(prev => prev.map(inst => 
      inst.id === instanceId ? { ...inst, status: newStatus } : inst
    ))
  }

  // Métricas calculadas
  const totalInstances = instances.length
  const activeInstances = instances.filter(i => i.status === 'RUNNING').length
  const totalRamUsed = instances.reduce((acc, inst) => acc + (inst.status === 'RUNNING' ? inst.ramLimit : 0), 0)
  const totalClients = clients.length

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando MoonPanel...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest font-sans uppercase neon-glow-blue">Dashboard de Control</h2>
          <p className="text-xs text-slate-500 font-mono tracking-wide mt-1">Control operativo global de moondev.online</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-moon-surface border border-moon-border hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg transition-all-custom flex items-center justify-center cursor-pointer"
            title="Refrescar datos"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <Link 
            to="/admin/create-client"
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-md shadow-blue-600/10 hover:shadow-blue-500/25 transition-all-custom text-xs uppercase tracking-wider font-sans cursor-pointer animate-pulse"
          >
            <Plus size={14} />
            <span>Crear Cliente</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-moon-surface/40 border border-blue-500/10 p-6 rounded-xl relative overflow-hidden group hover:border-blue-500/25 transition-all shadow-[0_0_10px_rgba(37,99,235,0.01)] hover:shadow-[0_0_15px_rgba(37,99,235,0.05)] cursor-default">
          <div className="absolute top-4 right-4 text-blue-500/20 group-hover:text-blue-400 transition-all-custom">
            <Server size={22} />
          </div>
          <p className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest mb-1">TOTAL INSTANCIAS</p>
          <h3 className="text-3xl font-bold text-white font-mono">{totalInstances}</h3>
          <p className="text-[10px] text-slate-600 mt-2 font-mono">Límite operativo: 6</p>
        </div>

        <div className="bg-moon-surface/40 border border-emerald-500/10 p-6 rounded-xl relative overflow-hidden group hover:border-emerald-500/25 transition-all shadow-[0_0_10px_rgba(34,197,94,0.01)] hover:shadow-[0_0_15px_rgba(34,197,94,0.05)] cursor-default">
          <div className="absolute top-4 right-4 text-emerald-500/20 group-hover:text-emerald-400 transition-all-custom">
            <Activity size={22} />
          </div>
          <p className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest mb-1">INSTANCIAS ACTIVAS</p>
          <h3 className="text-3xl font-bold text-emerald-400 font-mono">{activeInstances}</h3>
          <p className="text-[10px] text-slate-600 mt-2 font-mono">
            {totalInstances > 0 ? Math.round((activeInstances / totalInstances) * 100) : 0}% de carga activa
          </p>
        </div>

        <div className="bg-moon-surface/40 border border-fuchsia-500/10 p-6 rounded-xl relative overflow-hidden group hover:border-fuchsia-500/25 transition-all shadow-[0_0_10px_rgba(217,70,239,0.01)] hover:shadow-[0_0_15px_rgba(217,70,239,0.05)] cursor-default">
          <div className="absolute top-4 right-4 text-fuchsia-500/20 group-hover:text-fuchsia-400 transition-all-custom">
            <Cpu size={22} />
          </div>
          <p className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest mb-1">RAM ASIGNADA</p>
          <h3 className="text-3xl font-bold text-white font-mono">{(totalRamUsed / 1024).toFixed(2)} GB</h3>
          <p className="text-[10px] text-slate-600 mt-2 font-mono">Consumo total estimado</p>
        </div>

        <div className="bg-moon-surface/40 border border-cyan-500/10 p-6 rounded-xl relative overflow-hidden group hover:border-cyan-500/25 transition-all shadow-[0_0_10px_rgba(6,182,212,0.01)] hover:shadow-[0_0_15px_rgba(6,182,212,0.05)] cursor-default">
          <div className="absolute top-4 right-4 text-cyan-500/20 group-hover:text-cyan-400 transition-all-custom">
            <Users size={22} />
          </div>
          <p className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-widest mb-1">CLIENTES REGISTRADOS</p>
          <h3 className="text-3xl font-bold text-white font-mono">{totalClients}</h3>
          <p className="text-[10px] text-slate-600 mt-2 font-mono">Roles tipo CLIENT</p>
        </div>
      </div>

      {/* Discord Integration Section */}
      <div className="bg-moon-surface/30 border border-moon-border/40 p-5 rounded-xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Integración Discord</h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Administra y sincroniza los tableros de estado interactivos en tus canales.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {discordMessage && (
            <span className="text-[10px] font-mono px-3 py-1.5 bg-moon-card/80 border border-moon-border/40 rounded-lg text-slate-300">
              {discordMessage}
            </span>
          )}
          <button
            onClick={handleRecreateDiscord}
            disabled={recreatingDiscord}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-md transition-all text-[10px] uppercase tracking-wider font-sans cursor-pointer shrink-0"
          >
            {recreatingDiscord ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>Recreando...</span>
              </>
            ) : (
              <>
                <RefreshCw size={12} />
                <span>Recrear Tableros</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid of Instance Cards */}
      <h3 className="text-lg font-bold text-white mb-4 tracking-wide">Resumen Operativo</h3>
      {totalInstances === 0 ? (
        <div className="bg-moon-surface border border-moon-border/60 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-moon-card rounded-full border border-moon-border/80 flex items-center justify-center text-moon-text/40 mb-4">
            <Server size={20} />
          </div>
          <p className="text-moon-text/70 font-medium mb-1">No hay instancias Docker activas</p>
          <p className="text-xs text-moon-text/40 mb-4 max-w-sm">Al registrar un cliente, el sistema aprovisionará un contenedor automáticamente.</p>
          <Link 
            to="/admin/create-client"
            className="px-4 py-2.5 bg-moon-accent hover:bg-moon-hover text-white text-xs font-semibold rounded-lg transition-all-custom"
          >
            Aprovisionar Cliente
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {instances.map(instance => (
            <InstanceCard 
              key={instance.id} 
              instance={instance} 
              onStatusChange={handleStatusChange} 
              isAdminView={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}
