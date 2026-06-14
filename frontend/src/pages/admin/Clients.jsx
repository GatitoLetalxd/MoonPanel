import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Plus, Search, ShieldAlert, X, AlertCircle, Server } from 'lucide-react'
import api from '../../api/axios'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [clientToDelete, setClientToDelete] = useState(null)
  const [confirmUsername, setConfirmUsername] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Modal de nueva instancia
  const [showAddInstanceModal, setShowAddInstanceModal] = useState(false)
  const [clientForInstance, setClientForInstance] = useState(null)
  const [newInstanceLoading, setNewInstanceLoading] = useState(false)
  const [newInstanceError, setNewInstanceError] = useState('')
  const [newInstanceData, setNewInstanceData] = useState({
    subdomain: 'auto',
    ramLimit: 512,
    cpuLimit: 0.5,
    diskLimit: 2048,
    mode: 'SSH',
    database: 'NONE'
  })

  const openAddInstanceModal = (client) => {
    setClientForInstance(client)
    setNewInstanceError('')
    setNewInstanceData({
      subdomain: 'auto',
      ramLimit: 512,
      cpuLimit: 0.5,
      diskLimit: 2048,
      mode: 'SSH',
      database: 'NONE'
    })
    setShowAddInstanceModal(true)
  }

  const closeAddInstanceModal = () => {
    setShowAddInstanceModal(false)
    setClientForInstance(null)
  }

  const handleAddInstance = async (e) => {
    e.preventDefault()
    if (!clientForInstance) return

    setNewInstanceLoading(true)
    setNewInstanceError('')

    try {
      await api.post('/api/admin/instances', {
        userId: clientForInstance.id,
        subdomain: newInstanceData.subdomain,
        ramLimit: newInstanceData.ramLimit,
        cpuLimit: newInstanceData.cpuLimit,
        diskLimit: newInstanceData.diskLimit,
        mode: newInstanceData.mode,
        database: newInstanceData.database
      })
      
      // Recargar clientes
      await fetchClients()
      closeAddInstanceModal()
    } catch (err) {
      console.error('[ADD INSTANCE ERROR] Error:', err)
      setNewInstanceError(err.response?.data?.error || err.message || 'Error al asignar la instancia.')
    } finally {
      setNewInstanceLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const response = await api.get('/api/admin/clients')
      setClients(response.data)
    } catch (error) {
      console.error('[CLIENTS ERROR] Error al cargar clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const openDeleteModal = (client) => {
    setClientToDelete(client)
    setConfirmUsername('')
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setClientToDelete(null)
    setConfirmUsername('')
  }

  const handleDelete = async () => {
    if (!clientToDelete) return
    if (confirmUsername.toLowerCase() !== clientToDelete.username.toLowerCase()) {
      alert('El nombre de usuario no coincide.')
      return
    }

    setDeleteLoading(true)
    try {
      await api.delete(`/api/admin/clients/${clientToDelete.id}`)
      setClients(prev => prev.filter(c => c.id !== clientToDelete.id))
      closeDeleteModal()
    } catch (error) {
      console.error('[CLIENTS DELETE ERROR] Error:', error)
      alert(`Error al eliminar cliente: ${error.response?.data?.error || error.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Filtrar clientes
  const filteredClients = clients.filter(client => 
    client.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando Clientes...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Gestión de Clientes</h2>
          <p className="text-sm text-moon-text/50 font-mono">Listar y remover cuentas de clientes y sus entornos Docker</p>
        </div>
        <Link 
          to="/admin/create-client"
          className="flex items-center gap-2 px-4 py-3 bg-moon-accent hover:bg-moon-hover text-white font-semibold rounded-lg shadow-lg shadow-moon-accent/20 hover:shadow-moon-hover/30 transition-all-custom text-sm"
        >
          <Plus size={16} />
          <span>Crear Cliente</span>
        </Link>
      </div>

      {/* Search and Table Container */}
      <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-moon-border/60 flex items-center bg-moon-card/50">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-moon-text/40">
              <Search size={18} />
            </span>
            <input 
              type="text" 
              placeholder="Buscar por usuario o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent focus:outline-none text-white placeholder-moon-text/40 rounded-lg text-sm transition-all-custom font-mono"
            />
          </div>
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center text-moon-text/50">
              No se encontraron clientes registrados.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-moon-border text-moon-text/40 font-semibold text-xs tracking-wider uppercase font-mono bg-moon-card/30">
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Subdominio</th>
                  <th className="p-4">Puertos Asignados</th>
                  <th className="p-4">Fecha Registro</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-moon-border/60 text-sm text-white/90">
                {filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-moon-card/25 transition-all-custom">
                    <td className="p-4 font-semibold">{client.username}</td>
                    <td className="p-4 font-mono text-xs text-moon-text/80">{client.email}</td>
                    <td className="p-4">
                      {client.instances && client.instances.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {client.instances.map(inst => (
                            <a 
                              key={inst.id}
                              href={`http://${inst.subdomain}.moondev.online`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-moon-accent hover:underline inline-flex items-center gap-1 font-mono text-xs"
                            >
                              {inst.subdomain}.moondev.online
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-rose-400/80 text-xs italic">Sin Instancia</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {client.instances && client.instances.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {client.instances.map(inst => (
                            <div key={inst.id} className="flex gap-1.5 items-center">
                              <span className="text-[10px] text-moon-text/60 font-bold uppercase">{inst.subdomain}:</span>
                              <span className="px-1.5 py-0.5 bg-moon-card border border-moon-border rounded text-[10px]">Web: {inst.webPort}</span>
                              <span className="px-1.5 py-0.5 bg-moon-card border border-moon-border rounded text-[10px]">SSH: {inst.sshPort}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-4 text-xs text-moon-text/60 font-mono">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openAddInstanceModal(client)}
                          className="p-2 text-moon-accent hover:text-white hover:bg-moon-accent/20 border border-transparent hover:border-moon-accent/30 rounded-lg transition-all-custom"
                          title="Asignar Nueva Instancia"
                        >
                          <Server size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(client)}
                          className="p-2 text-rose-400 hover:text-white hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 rounded-lg transition-all-custom"
                          title="Eliminar Cliente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && clientToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-moon-surface border border-rose-500/20 rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Header */}
            <div className="p-6 bg-rose-500/10 border-b border-rose-500/20 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white tracking-wide">¿Eliminar Cliente y Recursos?</h3>
                <p className="text-xs text-rose-400/80 font-mono mt-1">
                  Cliente a eliminar: <span className="font-bold">{clientToDelete.username}</span>
                </p>
              </div>
              <button 
                onClick={closeDeleteModal}
                className="text-moon-text/40 hover:text-white transition-all-custom"
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Content */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-rose-950/25 border border-rose-900/40 text-rose-300 text-xs rounded-lg space-y-1">
                <p className="font-semibold text-rose-200">¡ADVERTENCIA DE SEGURIDAD!</p>
                <p className="leading-relaxed font-mono">
                  Esta acción es irreversible. Se eliminarán el container, todos los archivos y la configuración de red. El cliente perderá todo su trabajo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Escribe el nombre del cliente (<span className="font-mono text-white font-bold">{clientToDelete.username}</span>) para confirmar:
                </label>
                <input
                  type="text"
                  required
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder={clientToDelete.username}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-rose-500 focus:outline-none text-white placeholder-moon-text/20 rounded-lg font-mono text-sm transition-all-custom"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteLoading || confirmUsername.toLowerCase() !== clientToDelete.username.toLowerCase()}
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-rose-600/20 transition-all-custom flex items-center gap-1.5"
              >
                {deleteLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Eliminar permanentemente</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add Instance Modal */}
      {showAddInstanceModal && clientForInstance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-moon-surface border border-moon-border rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Header */}
            <div className="p-6 border-b border-moon-border/60 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-moon-accent/10 text-moon-accent flex items-center justify-center shrink-0">
                  <Server size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">Asignar Nueva Instancia</h3>
                  <p className="text-xs text-moon-text/50 font-mono mt-0.5">
                    Cliente: <span className="text-white font-bold">{clientForInstance.username}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={closeAddInstanceModal}
                className="text-moon-text/40 hover:text-white transition-all-custom"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddInstance}>
              {/* Content */}
              <div className="p-6 space-y-4">
                {newInstanceError && (
                  <div className="p-3 bg-rose-950/20 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                    <AlertCircle size={16} />
                    <span>{newInstanceError}</span>
                  </div>
                )}

                {/* Subdomain field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                    Subdominio
                  </label>
                  <input
                    type="text"
                    required
                    value={newInstanceData.subdomain}
                    onChange={(e) => setNewInstanceData(prev => ({ ...prev, subdomain: e.target.value }))}
                    placeholder="vmiXX o 'auto' para autogenerar"
                    className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent focus:outline-none text-white rounded-lg font-mono text-sm transition-all-custom"
                  />
                  <p className="text-[10px] text-moon-text/40 font-mono">
                    Usa <span className="text-moon-accent font-bold">auto</span> para asignar el siguiente correlativo secuencial vmiXX.
                  </p>
                </div>

                {/* Resource Limits */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                      RAM
                    </label>
                    <select
                      value={newInstanceData.ramLimit}
                      onChange={(e) => setNewInstanceData(prev => ({ ...prev, ramLimit: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 bg-moon-card border border-moon-border text-white text-xs font-mono rounded-lg focus:outline-none focus:border-moon-accent"
                    >
                      <option value={256}>256 MB</option>
                      <option value={512}>512 MB</option>
                      <option value={1024}>1024 MB</option>
                      <option value={2048}>2048 MB</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                      vCPU
                    </label>
                    <select
                      value={newInstanceData.cpuLimit}
                      onChange={(e) => setNewInstanceData(prev => ({ ...prev, cpuLimit: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-moon-card border border-moon-border text-white text-xs font-mono rounded-lg focus:outline-none focus:border-moon-accent"
                    >
                      <option value={0.25}>0.25 Cores</option>
                      <option value={0.5}>0.50 Cores</option>
                      <option value={1.0}>1.00 Cores</option>
                      <option value={2.0}>2.00 Cores</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                      Disco
                    </label>
                    <select
                      value={newInstanceData.diskLimit}
                      onChange={(e) => setNewInstanceData(prev => ({ ...prev, diskLimit: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 bg-moon-card border border-moon-border text-white text-xs font-mono rounded-lg focus:outline-none focus:border-moon-accent"
                    >
                      <option value={1024}>1 GB</option>
                      <option value={2048}>2 GB</option>
                      <option value={5120}>5 GB</option>
                      <option value={10240}>10 GB</option>
                    </select>
                  </div>
                </div>

                {/* Default Mode & Database */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                      Modo por Defecto
                    </label>
                    <select
                      value={newInstanceData.mode}
                      onChange={(e) => setNewInstanceData(prev => ({ ...prev, mode: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-moon-card border border-moon-border text-white text-xs font-mono rounded-lg focus:outline-none focus:border-moon-accent"
                    >
                      <option value="SSH">Acceso SSH</option>
                      <option value="AUTO_DEPLOY">Despliegue Git</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider">
                      Base de Datos
                    </label>
                    <select
                      value={newInstanceData.database}
                      onChange={(e) => setNewInstanceData(prev => ({ ...prev, database: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-moon-card border border-moon-border text-white text-xs font-mono rounded-lg focus:outline-none focus:border-moon-accent"
                    >
                      <option value="NONE">Ninguna</option>
                      <option value="POSTGRES">PostgreSQL</option>
                      <option value="MYSQL">MySQL</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 bg-moon-card border-t border-moon-border/60 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddInstanceModal}
                  className="px-4 py-2 bg-transparent hover:bg-moon-border/40 text-moon-text hover:text-white border border-moon-border rounded-lg text-sm font-semibold transition-all-custom"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newInstanceLoading}
                  className="px-4 py-2 bg-moon-accent hover:bg-moon-hover disabled:opacity-40 text-white rounded-lg text-sm font-semibold shadow-lg shadow-moon-accent/20 transition-all-custom flex items-center gap-1.5"
                >
                  {newInstanceLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Server size={16} />
                      <span>Reservar Instancia</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  )
}
