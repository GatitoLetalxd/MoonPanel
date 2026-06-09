import React from 'react'

export default function ResourceBar({ label, value, max, unit }) {
  const percentage = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0

  let barColor = 'bg-emerald-500 shadow-emerald-500/20'
  if (percentage > 85) {
    barColor = 'bg-rose-500 shadow-rose-500/20'
  } else if (percentage > 60) {
    barColor = 'bg-amber-500 shadow-amber-500/20'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-moon-text/75">{label}</span>
        <span className="text-white font-mono font-semibold">
          {value} {unit} / {max} {unit} ({percentage}%)
        </span>
      </div>
      <div className="h-2.5 w-full bg-moon-card border border-moon-border/60 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${barColor}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
