'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Employees from '@/components/EmployeesNew'
import RosterView from '@/components/RosterView'
import OptimizerSettings from '@/components/OptimizerSettings'
import AdminPanel from '@/components/AdminPanel'
import Dashboard from '@/components/Dashboard'
import Forecast from '@/components/Forecast'
import EmployeeHours from '@/components/EmployeeHours'

type Tab = 'schedule' | 'dashboard' | 'hours' | 'forecast' | 'employees' | 'settings' | 'admin'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule')
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const router = useRouter()

  // Load saved tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab')
    if (savedTab && ['schedule', 'dashboard', 'hours', 'forecast', 'employees', 'settings', 'admin'].includes(savedTab)) {
      setActiveTab(savedTab as Tab)
    }
  }, [])

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return null
  }

  const tabs = [
    { id: 'schedule' as Tab, label: 'Schedule', icon: '📅' },
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: '📊' },
    { id: 'hours' as Tab, label: 'Hours', icon: '⏱️' },
    { id: 'forecast' as Tab, label: 'Forecast', icon: '📈' },
    { id: 'employees' as Tab, label: 'Employees', icon: '👥' },
    { id: 'admin' as Tab, label: 'Admin', icon: '⚡' },
    { id: 'settings' as Tab, label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      {/* Modern Header with Glassmorphism Effect */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                Staff Admin
              </h1>
              <p className="mt-0.5 text-xs text-gray-500">
                Workforce management system
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-600">
                  {user?.role === 'super_admin' ? 'Super Admin' : 'Department Admin'}
                </p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all duration-200 border border-red-200 hover:border-red-300"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Tab Navigation with Pill Design */}
      <nav className="bg-white/60 backdrop-blur-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 overflow-x-auto py-4 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group relative px-5 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap
                  transition-all duration-300 ease-out
                  ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-md'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <span className={`text-base ${activeTab === tab.id ? 'scale-110' : 'opacity-70 group-hover:opacity-100'} transition-all`}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content Area with Smooth Transitions */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-fadeIn">
          {activeTab === 'schedule' && <RosterView />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'hours' && <EmployeeHours />}
          {activeTab === 'forecast' && <Forecast />}
          {activeTab === 'employees' && <Employees />}
          {activeTab === 'admin' && <AdminPanel />}
          {activeTab === 'settings' && <OptimizerSettings />}
        </div>
      </main>
    </div>
  )
}
