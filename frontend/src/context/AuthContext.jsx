import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)  // true while checking session on mount
  const [authError, setAuthError] = useState('')

  // Check existing session on app load
  const checkAuth = useCallback(async () => {
    setLoading(true)
    try {
      const data = await authAPI.me()
      if (data.authenticated) {
        setUser(data.user)
        setIsAuthenticated(true)
        setAuthError('')
      } else {
        setUser(null)
        setIsAuthenticated(false)
        setAuthError('')
      }
    } catch (error) {
      setUser(null)
      setIsAuthenticated(false)
      if (error?.status === 401) {
        setAuthError('')
      } else {
        setAuthError(
          error?.message ||
            'Could not verify your HowToob session on this device. Check your connection and try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Login
  async function login(email, password) {
    setAuthError('')
    try {
      const data = await authAPI.login(email, password)
      setUser(data.user)
      setIsAuthenticated(true)
      return data.user
    } catch (error) {
      if (error?.status !== 401) {
        setAuthError(
          error?.message ||
            'Login could not be completed on this device. Check your connection and try again.'
        )
      }
      throw error
    }
  }

  // Register
  async function register(username, email, password, role = 'viewer') {
    const data = await authAPI.register(username, email, password, role)
    return data
  }

  // Logout
  async function logout() {
    try {
      await authAPI.logout()
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      setAuthError('')
    }
  }

  function clearAuthError() {
    setAuthError('')
  }

  // Convenience helpers
  const isCreator = user?.role === 'creator'
  const isAdmin = user?.role === 'admin'

  const value = {
    user,
    isAuthenticated,
    loading,
    authError,
    isCreator,
    isAdmin,
    login,
    register,
    logout,
    checkAuth,
    clearAuthError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
