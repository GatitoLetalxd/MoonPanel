import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Plus, Search, ShieldAlert, X, AlertCircle } from 'lucide-react'
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
    <div className="flex-1 p-8 bg-moon-bg min-h-screen relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
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
                      {client.instance ? (
                        <a 
                          href={`http://${client.instance.subdomain}.moondev.online`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-moon-accent hover:underline inline-flex items-center gap-1 font-mono text-xs"
                        >
                          {client.instance.subdomain}.moondev.online
                        </a>
                      ) : (
                        <span className="text-rose-400/80 text-xs italic">Sin Instancia</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {client.instance ? (
                        <div className="flex gap-2">
                          <span className="px-1.5 py-0.5 bg-moon-card border border-moon-border rounded">Web: {client.instance.webPort}</span>
                          <span className="px-1.5 py-0.5 bg-moon-card border border-moon-border rounded">SSH: {client.instance.sshPort}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-4 text-xs text-moon-text/60 font-mono">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openDeleteModal(client)}
                        className="p-2 text-rose-400 hover:text-white hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 rounded-lg transition-all-custom"
                        title="Eliminar Cliente"
                      >
                        <Trash2 size={16} />
                      </button>
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
    </div>
  )
}
