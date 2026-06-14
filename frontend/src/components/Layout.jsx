import React, { useState } from 'react'
import Sidebar from './Sidebar'
import { Menu, X } from 'lucide-react'

export default function Layout({ children }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-moon-bg overflow-x-hidden">
      {/* Backdrop for mobile drawer */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer container */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-50 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out shrink-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar onCloseMobile={() => setIsOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden">
        {/* Mobile top header bar */}
        <header className="flex md:hidden items-center justify-between px-6 py-4 bg-moon-surface border-b border-moon-border shrink-0 z-30">
          <div className="flex items-center gap-2">
            <img src="/Moon-icon.png" alt="MoonPanel Logo" className="w-8 h-8 object-contain rounded-lg" />
            <div>
              <h1 className="font-bold text-sm leading-tight text-white tracking-wide">MoonPanel</h1>
              <span className="text-[10px] text-moon-accent font-semibold tracking-wider font-mono">moondev.online</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-moon-text hover:text-white hover:bg-moon-border/40 rounded-lg focus:outline-none transition-colors"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
