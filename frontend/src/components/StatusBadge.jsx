import React from 'react'

export default function StatusBadge({ status }) {
  let styles = ''
  let label = status

  switch (status) {
    case 'RUNNING':
      styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      label = 'ACTIVO'
      break
    case 'STOPPED':
      styles = 'bg-zinc-800 text-zinc-400 border-zinc-700'
      label = 'DETENIDO'
      break
    case 'CREATING':
      styles = 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      label = 'CREANDO'
      break
    case 'ERROR':
      styles = 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      label = 'ERROR'
      break
    default:
      styles = 'bg-zinc-850 text-zinc-400 border-zinc-750'
      label = status || 'DESCONOCIDO'
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold font-mono tracking-wider rounded-md border ${styles}`}>
      {status === 'RUNNING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-running" />
      )}
      {status === 'CREATING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {status === 'ERROR' && (
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
      )}
      {status === 'STOPPED' && (
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
      )}
      {label}
    </span>
  )
}
