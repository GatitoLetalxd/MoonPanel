import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Square, RotateCcw, ExternalLink, ShieldAlert, ArrowRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import api from '../api/axios'

export default function InstanceCard({ instance, onStatusChange, isAdminView = false }) {
  const [loading, setLoading] = useState(false)
  const fullDomain = `${instance.subdomain}.moondev.online`

  const handleAction = async (action) => {
    setLoading(true)
    try {
      const endpoint = isAdminView 
        ? `/api/admin/instances/${instance.id}/${action}`
        : `/api/client/instance/${action}`
      
      const response = await api.post(endpoint)
      if (onStatusChange) {
        onStatusChange(instance.id, response.data.status)
      }
    } catch (error) {
      console.error(`Error executing container action ${action}:`, error)
      alert(`Error al ejecutar acción: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-moon-surface border border-moon-border hover:border-moon-accent/40 rounded-xl p-6 transition-all-custom flex flex-col justify-between h-full group">
      <div>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h3 className="font-bold text-lg text-white group-hover:text-moon-accent transition-all-custom">
              {instance.subdomain}
            </h3>
            {isAdminView && instance.user && (
              <span className="text-xs text-moon-text/60 font-mono">
                Cliente: {instance.user.username}
              </span>
            )}
          </div>
          <StatusBadge status={instance.status} />
        </div>

        {/* Info list */}
        <div className="space-y-2 mb-6 font-mono text-xs text-moon-text/80 bg-moon-card p-3.5 rounded-lg border border-moon-border/60">
          <div className="flex justify-between">
            <span className="text-moon-text/50">Subdominio:</span>
            <a 
              href={`http://${fullDomain}`} 
              target="_blank" 
              rel="noreferrer" 
              className="text-moon-accent hover:underline flex items-center gap-1"
            >
              {fullDomain} <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-moon-text/50">Puerto Web:</span>
            <span className="text-white font-semibold">{instance.webPort}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-moon-text/50">Puerto SSH:</span>
            <span className="text-white font-semibold">{instance.sshPort}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => handleAction('start')}
          disabled={loading || instance.status === 'RUNNING'}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-semibold tracking-wider font-mono uppercase transition-all-custom"
          title="Iniciar Instancia"
        >
          <Play size={14} />
          <span>Start</span>
        </button>

        <button
          onClick={() => handleAction('stop')}
          disabled={loading || instance.status === 'STOPPED'}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-xs font-semibold tracking-wider font-mono uppercase transition-all-custom"
          title="Detener Instancia"
        >
          <Square size={14} />
          <span>Stop</span>
        </button>

        <button
          onClick={() => handleAction('restart')}
          disabled={loading}
          className="p-2 bg-moon-card hover:bg-moon-border/60 text-moon-text/80 border border-moon-border/60 rounded-lg transition-all-custom"
          title="Reiniciar Instancia"
        >
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {isAdminView && (
          <Link
            to={`/admin/instances/${instance.id}`}
            className="p-2 bg-moon-accent/10 hover:bg-moon-accent text-moon-accent hover:text-white border border-moon-accent/20 hover:border-transparent rounded-lg transition-all-custom"
            title="Detalles / Administrar"
          >
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  )
}
