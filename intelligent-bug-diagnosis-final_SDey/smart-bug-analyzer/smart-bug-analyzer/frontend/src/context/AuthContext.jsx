import React, { createContext, useContext, useState, useCallback } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('sba_user')
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const persist = (token, userData) => {
    localStorage.setItem('sba_token', token)
    localStorage.setItem('sba_user', JSON.stringify(userData))
    setUser(userData)
  }

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.post('/auth/login', { email, password })
      persist(data.access_token, data.user)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to sign in. Check your credentials.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (fullName, email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.post('/auth/register', {
        full_name: fullName,
        email,
        password,
      })
      persist(data.access_token, data.user)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to create account.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sba_token')
    localStorage.removeItem('sba_user')
    setUser(null)
  }, [])

  const updateUser = useCallback((userData) => {
    localStorage.setItem('sba_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, register, logout, updateUser, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
