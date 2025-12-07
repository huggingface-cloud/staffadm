'use client'

import { useState } from 'react'
import Employees from '@/components/EmployeesNew'
import RosterEngine from '@/components/RosterEngine'
import RosterView from '@/components/RosterView'

type Tab = 'schedule' | 'optimizer' | 'employees'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule')

  const tabs = [
    { id: 'schedule' as Tab, label: '📅 Schedule View' },
    { id: 'optimizer' as Tab, label: '🎯 Roster Optimizer' },
    { id: 'employees' as Tab, label: '👥 Employees' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Staff Admin & Rostering System
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Comprehensive staff management and scheduling
            </p>
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
        {activeTab === 'optimizer' && <RosterEngine />}
        {activeTab === 'employees' && <Employees />}
      </main>
    </div>
  )
}
