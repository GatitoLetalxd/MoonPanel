import React, { useState, useEffect } from 'react'
import { Server, ChevronDown } from 'lucide-react'
import api from '../api/axios'

export default function InstanceSelector() {
  const [instances, setInstances] = useState([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const res = await api.get('/api/client/instances')
        setInstances(res.data)

        if (res.data.length > 0) {
          const storedId = localStorage.getItem('activeInstanceId')
          // Verificar si el ID guardado todavía pertenece a las instancias del usuario
          const exists = res.data.some(i => i.id === storedId)
          if (storedId && exists) {
            setActiveId(storedId)
          } else {
            // Activar la primera por defecto
            localStorage.setItem('activeInstanceId', res.data[0].id)
            setActiveId(res.data[0].id)
          }
        }
      } catch (err) {
        console.error('Error fetching client instances:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInstances()
  }, [])

  const handleChange = (e) => {
    const newId = e.target.value
    localStorage.setItem('activeInstanceId', newId)
    setActiveId(newId)
    // Recargar la página para re-inicializar sockets/SSE e inyectar cabeceras nuevas de Axios
    window.location.reload()
  }

  if (loading || instances.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center gap-2 bg-moon-card border border-moon-border/60 px-3 py-1.5 rounded-lg text-xs font-mono shrink-0">
      <Server size={14} className="text-moon-accent shrink-0 animate-pulse" />
      <span className="text-moon-text/50 uppercase font-bold text-[10px] hidden sm:inline">Servidor:</span>
      <div className="relative flex items-center">
        <select
          value={activeId}
          onChange={handleChange}
          className="appearance-none bg-transparent text-white font-bold pr-5 focus:outline-none cursor-pointer"
        >
          {instances.map(inst => (
            <option key={inst.id} value={inst.id} className="bg-moon-surface text-white">
              {inst.subdomain} ({inst.status})
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="text-moon-text/60 absolute right-0 pointer-events-none" />
      </div>
    </div>
  )
}
