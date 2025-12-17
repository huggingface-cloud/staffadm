'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, Clock, ExternalLink, Copy, Check } from 'lucide-react'

interface ServiceStatus {
  name: string
  url: string
  localUrl: string
  deployedUrl?: string
  status: 'online' | 'offline' | 'checking'
  responseTime?: number
  lastChecked?: Date
  error?: string
  port?: number
  environment: 'local' | 'deployed' | 'ngrok'
  ngrokUrl?: string
}

export default function Health() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'Backend API',
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      localUrl: 'http://localhost:8000',
      deployedUrl: 'https://staffadm.onrender.com',
      status: 'checking',
      port: 8000,
      environment: 'local'
    },
    {
      name: 'Optimizer API',
      url: 'http://localhost:9001',
      localUrl: 'http://localhost:9001',
      deployedUrl: 'https://staffadmin-optimizer.onrender.com',
      status: 'checking',
      port: 9001,
      environment: 'local'
    },
    {
      name: 'Frontend (Next.js)',
      url: 'http://localhost:3000',
      localUrl: 'http://localhost:3000',
      deployedUrl: 'https://staffadmin.vercel.app',
      status: 'checking',
      port: 3000,
      environment: 'local'
    }
  ])

  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const checkServiceHealth = async (service: ServiceStatus): Promise<ServiceStatus> => {
    const startTime = Date.now()

    try {
      let endpoint = service.url

      if (service.name === 'Backend API') {
        endpoint = `${service.url}/health`
      } else if (service.name === 'Optimizer API') {
        endpoint = `${service.url}/`
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })

      const responseTime = Date.now() - startTime

      if (response.ok) {
        return {
          ...service,
          status: 'online',
          responseTime,
          lastChecked: new Date(),
          error: undefined
        }
      } else {
        return {
          ...service,
          status: 'offline',
          responseTime,
          lastChecked: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (error) {
      return {
        ...service,
        status: 'offline',
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  const checkAllServices = async () => {
    setLastRefresh(new Date())
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as const })))

    const results = await Promise.all(
      services.map(service => checkServiceHealth(service))
    )

    setServices(results)
  }

  useEffect(() => {
    checkAllServices()

    if (autoRefresh) {
      const interval = setInterval(checkAllServices, 10000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedUrl(text)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'checking': return 'bg-yellow-500 animate-pulse'
    }
  }

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online': return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'offline': return <XCircle className="w-5 h-5 text-red-500" />
      case 'checking': return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
    }
  }

  const onlineCount = services.filter(s => s.status === 'online').length
  const offlineCount = services.filter(s => s.status === 'offline').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor all StaffAdmin services in real-time
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium ${
              autoRefresh ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700'
            } hover:shadow transition-shadow`}
          >
            {autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}
          </button>
          <button
            onClick={checkAllServices}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600">Total Services</div>
          <div className="text-2xl font-bold mt-1">{services.length}</div>
        </div>

        <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-green-600">Online</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{onlineCount}</div>
        </div>

        <div className="bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-red-600">Offline</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{offlineCount}</div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((service) => (
          <div key={service.name} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(service.status)}`} />
                  <div>
                    <h3 className="font-bold text-sm">{service.name}</h3>
                    <p className="text-xs text-gray-600">
                      {service.status === 'online' ? 'Operational' :
                       service.status === 'offline' ? 'Down' : 'Checking...'}
                    </p>
                  </div>
                </div>
                {getStatusIcon(service.status)}
              </div>

              <div className="space-y-3">
                {/* Local URL */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1">LOCAL URL</div>
                  <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                    <code className="text-gray-700 dark:text-gray-300 truncate flex-1">
                      {service.localUrl}
                    </code>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => copyToClipboard(service.localUrl)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        {copiedUrl === service.localUrl ?
                          <Check className="w-3 h-3" /> :
                          <Copy className="w-3 h-3" />
                        }
                      </button>
                      <button
                        onClick={() => window.open(service.localUrl, '_blank')}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div>
                    <div className="font-semibold text-gray-500">PORT</div>
                    <div className="font-mono">{service.port || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500">RESPONSE</div>
                    <div className="font-mono">
                      {service.responseTime ? `${service.responseTime}ms` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {service.error && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 p-2 rounded text-xs">
                    <div className="font-semibold text-red-600 mb-1">ERROR</div>
                    <div className="text-red-700 dark:text-red-300">{service.error}</div>
                  </div>
                )}

                {/* Status Badge */}
                <div className={`w-full text-center py-1.5 rounded font-semibold text-xs ${
                  service.status === 'online' ? 'bg-green-100 text-green-700' :
                  service.status === 'offline' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {service.status.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last Refresh */}
      <div className="text-center text-sm text-gray-500">
        Last refreshed: {lastRefresh.toLocaleTimeString()}
        {autoRefresh && ' • Auto-refresh every 10s'}
      </div>
    </div>
  )
}
