import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'

// Admin pages
import Dashboard from './pages/admin/Dashboard'
import Clients from './pages/admin/Clients'
import CreateClient from './pages/admin/CreateClient'
import InstanceDetail from './pages/admin/InstanceDetail'

// Client pages
import MyInstance from './pages/client/MyInstance'
import SSHKeys from './pages/client/SSHKeys'

// Componente para proteger rutas que requieren estar autenticado y rol ADMIN
function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (!isAdmin) {
    return <Navigate to="/client/my-instance" />
  }

  return (
    <div className="flex min-h-screen bg-moon-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

// Componente para proteger rutas que requieren estar autenticado y rol CLIENT
function ClientRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" />
  }

  return (
    <div className="flex min-h-screen bg-moon-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

// Redireccionar al inicio según el rol actual del usuario
function HomeRedirect() {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-moon-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-moon-accent/30 border-t-moon-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  return isAdmin ? <Navigate to="/admin/dashboard" /> : <Navigate to="/client/my-instance" />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta de Login */}
          <Route path="/login" element={<Login />} />

          {/* Rutas del Admin */}
          <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/admin/create-client" element={<AdminRoute><CreateClient /></AdminRoute>} />
          <Route path="/admin/instances/:id" element={<AdminRoute><InstanceDetail /></AdminRoute>} />

          {/* Rutas del Cliente */}
          <Route path="/client/my-instance" element={<ClientRoute><MyInstance /></ClientRoute>} />
          <Route path="/client/ssh-keys" element={<ClientRoute><SSHKeys /></ClientRoute>} />

          {/* Redirección home y comodín */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
