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
    { id: 'schedule' as Tab, label: '📅 Schedule View' },
    { id: 'dashboard' as Tab, label: '📊 Dashboard' },
    { id: 'hours' as Tab, label: '⏱️ Hours Tracking' },
    { id: 'forecast' as Tab, label: '📈 Forecast & Gaps' },
    { id: 'employees' as Tab, label: '👥 Employees' },
    { id: 'admin' as Tab, label: '⚡ Admin Panel' },
    { id: 'settings' as Tab, label: '⚙️ Optimizer Settings' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Staff Admin & Rostering System
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Comprehensive staff management and scheduling
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'super_admin' ? 'Super Admin' : 'Department Admin'}
                </p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 overflow-x-auto py-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap
                  transition-colors duration-150
                  ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'schedule' && <RosterView />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'hours' && <EmployeeHours />}
        {activeTab === 'forecast' && <Forecast />}
        {activeTab === 'employees' && <Employees />}
        {activeTab === 'admin' && <AdminPanel />}
        {activeTab === 'settings' && <OptimizerSettings />}
      </main>
    </div>
  )
}
