'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// Types
interface User {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'dept_admin'
  department_id?: string
  department_name?: string
  department_code?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
  isSuperAdmin: boolean
  isDeptAdmin: boolean
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001'

// Provider component
interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Load token and user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')

    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }

    setIsLoading(false)
  }, [])

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Login failed')
      }

      const data = await response.json()

      // Store token and user
      localStorage.setItem('auth_token', data.access_token)
      localStorage.setItem('auth_user', JSON.stringify(data.user))

      setToken(data.access_token)
      setUser(data.user)

      // Redirect to home page
      router.push('/')
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Logout function
  const logout = () => {
    // Clear local storage
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')

    // Clear state
    setToken(null)
    setUser(null)

    // Redirect to login
    router.push('/login')
  }

  // Computed values
  const isAuthenticated = !!user && !!token
  const isSuperAdmin = user?.role === 'super_admin'
  const isDeptAdmin = user?.role === 'dept_admin'

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated,
    isSuperAdmin,
    isDeptAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper hook for making authenticated API requests
export function useAuthFetch() {
  const { token, logout } = useAuth()

  const authFetch = async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('Not authenticated')
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, { ...options, headers })

    // If unauthorized, logout
    if (response.status === 401) {
      logout()
      throw new Error('Session expired. Please login again.')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || 'Request failed')
    }

    return response
  }

  return authFetch
}
