import React, { useState, useEffect } from 'react'
import { Key, Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, Info, Copy, Check } from 'lucide-react'
import api from '../../api/axios'

export default function SSHKeys() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [copiedCode, setCopiedCode] = useState('')

  const fetchKeys = async () => {
    try {
      const response = await api.get('/api/client/ssh-keys')
      setKeys(response.data)
    } catch (error) {
      console.error('[SSH KEYS ERROR]', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(key)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  const handleAddKey = async (e) => {
    e.preventDefault()
    if (!label.trim() || !publicKey.trim()) return

    setActionLoading(true)
    try {
      const response = await api.post('/api/client/ssh-keys', {
        label: label.trim(),
        publicKey: publicKey.trim()
      })
      
      setKeys(prev => [...prev, response.data.key])
      setLabel('')
      setPublicKey('')
      alert('Llave SSH añadida e inyectada con éxito en tu contenedor.')
    } catch (error) {
      alert(`Error al añadir llave: ${error.response?.data?.error || error.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteKey = async (keyId) => {
    if (!confirm('¿Seguro que deseas eliminar esta llave? Perderás el acceso inmediato con este certificado.')) return

    try {
      await api.delete(`/api/client/ssh-keys/${keyId}`)
      setKeys(prev => prev.filter(k => k.id !== keyId))
      alert('Llave removida con éxito del contenedor.')
    } catch (error) {
      alert(`Error al eliminar llave: ${error.response?.data?.error || error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
          <span className="text-moon-text/60 font-mono text-sm">Cargando llaves...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 sm:p-8 bg-moon-bg min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-wide">Mis Llaves SSH</h2>
        <p className="text-sm text-moon-text/50 font-mono">Gestiona certificados autorizados para acceder directamente por SSH</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Listing and adding keys */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Add Key Form */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-6 flex items-center gap-2">
              <Plus size={18} className="text-moon-accent" />
              <span>Cargar Nueva Llave SSH</span>
            </h3>

            <form onSubmit={handleAddKey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Etiqueta / Nombre
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Laptop casa / PC oficina"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/20 rounded-lg focus:outline-none transition-all-custom font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-moon-text/70 uppercase tracking-wider mb-2">
                  Contenido de Llave Pública (.pub)
                </label>
                <textarea
                  required
                  rows="4"
                  placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC..."
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-moon-card border border-moon-border hover:border-moon-text/30 focus:border-moon-accent text-white placeholder-moon-text/20 rounded-lg focus:outline-none transition-all-custom font-mono text-xs leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2.5 bg-moon-accent hover:bg-moon-hover disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all-custom"
              >
                {actionLoading ? 'Inyectando llave en Docker...' : 'Registrar Llave SSH'}
              </button>
            </form>
          </div>

          {/* Keys list */}
          <div className="bg-moon-surface border border-moon-border p-6 rounded-xl">
            <h3 className="font-bold text-white text-base mb-4">Llaves SSH Autorizadas</h3>

            {keys.length === 0 ? (
              <div className="p-8 border border-dashed border-moon-border rounded-lg bg-moon-card/30 text-center flex flex-col items-center">
                <Key className="text-moon-text/30 mb-2" size={24} />
                <p className="text-xs text-moon-text/40 font-mono">
                  No tienes llaves SSH cargadas. Usa el formulario superior para añadir una.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-moon-border/40">
                {keys.map(key => (
                  <div key={key.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <Key size={14} className="text-moon-accent" />
                        <span className="font-bold text-white text-sm">{key.label}</span>
                      </div>
                      <p className="text-[10px] text-moon-text/50 font-mono truncate select-all">{key.publicKey}</p>
                      <span className="text-[10px] text-moon-text/30 font-mono">
                        Cargada el: {new Date(key.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-2 text-rose-400 hover:text-white hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 rounded-lg transition-all-custom shrink-0"
                      title="Remover llave de contenedor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Collapsible Instructions */}
        <div>
          <div className="bg-moon-surface border border-moon-border rounded-xl overflow-hidden">
            
            {/* Header / Toggle Button */}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-5 bg-moon-card/50 hover:bg-moon-card flex items-center justify-between text-left font-semibold text-white transition-all-custom border-b border-moon-border/60"
            >
              <span className="flex items-center gap-2">
                <Info size={18} className="text-moon-accent" />
                <span>¿Cómo generar una Llave SSH?</span>
              </span>
              {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {/* Instruction body */}
            <div className={`transition-all duration-300 ease-in-out ${showGuide ? 'max-h-[800px] p-5 border-t border-moon-border/30 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="space-y-6 text-xs text-moon-text/85 font-mono">
                
                {/* Windows Guide */}
                <div className="space-y-2">
                  <p className="font-bold text-white border-b border-moon-border pb-1">Windows (PowerShell o Git Bash)</p>
                  <p className="leading-relaxed text-[11px]">
                    1. Abre PowerShell o CMD y ejecuta:
                  </p>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                    <span className="text-moon-accent">ssh-keygen -t rsa -b 4096</span>
                    <button 
                      onClick={() => handleCopy('ssh-keygen -t rsa -b 4096', 'win1')}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                    >
                      {copiedCode === 'win1' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    2. Presiona ENTER en todo (sin contraseña si deseas acceso automático).
                  </p>
                  <p className="leading-relaxed text-[11px]">
                    3. Copia el contenido de la llave pública con:
                  </p>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                    <span className="text-moon-accent">cat ~/.ssh/id_rsa.pub</span>
                    <button 
                      onClick={() => handleCopy('cat ~/.ssh/id_rsa.pub', 'win2')}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                    >
                      {copiedCode === 'win2' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {/* Linux/Mac Guide */}
                <div className="space-y-2">
                  <p className="font-bold text-white border-b border-moon-border pb-1">Linux / MacOS</p>
                  <p className="leading-relaxed text-[11px]">
                    1. Abre la terminal y genera el par de llaves:
                  </p>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                    <span className="text-moon-accent">ssh-keygen -t ed25519</span>
                    <button 
                      onClick={() => handleCopy('ssh-keygen -t ed25519', 'unix1')}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                    >
                      {copiedCode === 'unix1' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    2. Copia la llave resultante para pegarla en el panel:
                  </p>
                  <div className="flex items-center justify-between bg-moon-bg border border-moon-border p-2 rounded">
                    <span className="text-moon-accent">cat ~/.ssh/id_ed25519.pub</span>
                    <button 
                      onClick={() => handleCopy('cat ~/.ssh/id_ed25519.pub', 'unix2')}
                      className="p-1 hover:bg-moon-border text-moon-text/50 hover:text-white rounded"
                    >
                      {copiedCode === 'unix2' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded leading-relaxed text-[10px]">
                  <AlertCircle size={14} className="inline mr-1 -mt-0.5" />
                  Asegúrate de copiar todo el contenido que inicia con <span className="font-bold text-white">ssh-rsa</span> o <span className="font-bold text-white">ssh-ed25519</span> y termina con tu usuario de terminal.
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}
