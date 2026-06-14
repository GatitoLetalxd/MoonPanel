import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Server, Users, HardDrive, Cpu, Plus, RefreshCw, ExternalLink, Activity } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import InstanceCard from '../../components/InstanceCard'
import api from '../../api/axios'

export default function Dashboard() {
  const [instances, setInstances] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Dashboard de Control</h2>
          <p className="text-sm text-moon-text/50 font-mono">Control operativo global de moondev.online</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-moon-surface border border-moon-border hover:border-moon-accent/50 text-moon-text hover:text-white rounded-lg transition-all-custom flex items-center justify-center"
            title="Refrescar datos"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <Link 
            to="/admin/create-client"
            className="flex items-center gap-2 px-4 py-3 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-lg shadow-lg shadow-moon-accent/20 hover:shadow-moon-hover/30 transition-all-custom text-sm"
          >
            <Plus size={16} />
            <span>Crear Cliente</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-moon-surface border border-moon-border p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-moon-text/25 group-hover:text-moon-accent transition-all-custom">
            <Server size={24} />
          </div>
          <p className="text-xs font-semibold text-moon-text/50 font-mono uppercase tracking-wider mb-1">Total Instancias</p>
          <h3 className="text-3xl font-bold text-white font-mono">{totalInstances}</h3>
          <p className="text-xs text-moon-text/40 mt-2 font-mono">Límite operativo: 6</p>
        </div>

        <div className="bg-moon-surface border border-moon-border p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-emerald-500/20 group-hover:text-emerald-400 transition-all-custom">
            <Activity size={24} />
          </div>
          <p className="text-xs font-semibold text-moon-text/50 font-mono uppercase tracking-wider mb-1">Instancias Activas</p>
          <h3 className="text-3xl font-bold text-emerald-400 font-mono">{activeInstances}</h3>
          <p className="text-xs text-moon-text/40 mt-2 font-mono">
            {totalInstances > 0 ? Math.round((activeInstances / totalInstances) * 100) : 0}% de carga activa
          </p>
        </div>

        <div className="bg-moon-surface border border-moon-border p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-moon-text/25 group-hover:text-moon-accent transition-all-custom">
            <Cpu size={24} />
          </div>
          <p className="text-xs font-semibold text-moon-text/50 font-mono uppercase tracking-wider mb-1">RAM Asignada Activa</p>
          <h3 className="text-3xl font-bold text-white font-mono">{(totalRamUsed / 1024).toFixed(2)} GB</h3>
          <p className="text-xs text-moon-text/40 mt-2 font-mono">Consumo total estimado</p>
        </div>

        <div className="bg-moon-surface border border-moon-border p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-moon-text/25 group-hover:text-moon-accent transition-all-custom">
            <Users size={24} />
          </div>
          <p className="text-xs font-semibold text-moon-text/50 font-mono uppercase tracking-wider mb-1">Clientes Registrados</p>
          <h3 className="text-3xl font-bold text-white font-mono">{totalClients}</h3>
          <p className="text-xs text-moon-text/40 mt-2 font-mono">Roles tipo CLIENT</p>
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
