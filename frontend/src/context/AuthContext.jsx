import React, { createContext, useState, useEffect, useContext } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verifySession() {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await api.get('/api/auth/me')
        setUser(response.data)
      } catch (error) {
        console.error('[AUTH CONTEXT] Error al verificar sesión:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    verifySession()
  }, [])

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login', { username, password })
      const { accessToken, user: userData } = response.data
      
      localStorage.setItem('token', accessToken)
      localStorage.setItem('user', JSON.stringify(userData))
      
      setUser(userData)
      return userData
    } catch (error) {
      console.error('[AUTH CONTEXT] Error en login:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout').catch(() => {})
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
    }
  }

  const value = {
    user,
    setUser,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'ADMIN'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
