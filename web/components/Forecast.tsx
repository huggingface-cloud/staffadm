'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns'

interface Gap {
  shift_id: string
  date: string
  start_time: string
  end_time: string
  location: string
  department: string
  required_role: string
  headcount_needed: number
  current_assigned: number
  shortage: number
}

interface GapAnalysis {
  gaps: Gap[]
  skill_demand: Record<string, number>
  total_uncovered_shifts: number
  total_headcount_shortage: number
  absence_rate: number
  total_shifts_analyzed: number
}

interface WorkforceTrends {
  daily_demand: Array<{
    date: string
    required: number
    assigned: number
    gap: number
  }>
  role_distribution: Record<string, number>
  coverage_rate: number
  total_shifts: number
}

export default function Forecast() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return format(startOfWeek(today), 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return format(addDays(startOfWeek(today), 30), 'yyyy-MM-dd')
  })
  const [absenceRate, setAbsenceRate] = useState(0) // 0-100%
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null)
  const [trends, setTrends] = useState<WorkforceTrends | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchForecastData()
  }, [startDate, endDate, absenceRate])

  const fetchForecastData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch gap analysis with absence simulation
      const gapsResponse = await fetch(
        `http://localhost:8001/api/forecast/gaps?start_date=${startDate}&end_date=${endDate}&absence_rate=${absenceRate / 100}`
      )
      if (!gapsResponse.ok) throw new Error('Failed to fetch gap analysis')
      const gapsData = await gapsResponse.json()
      setGapAnalysis(gapsData)

      // Fetch workforce trends
      const trendsResponse = await fetch(
        `http://localhost:8001/api/forecast/workforce-trends?start_date=${startDate}&end_date=${endDate}`
      )
      if (!trendsResponse.ok) throw new Error('Failed to fetch workforce trends')
      const trendsData = await trendsResponse.json()
      setTrends(trendsData)

    } catch (err) {
      console.error('Failed to load forecast data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const getGapSeverityColor = (shortage: number) => {
    if (shortage >= 5) return 'bg-red-100 border-red-300 text-red-900'
    if (shortage >= 3) return 'bg-orange-100 border-orange-300 text-orange-900'
    return 'bg-yellow-100 border-yellow-300 text-yellow-900'
  }

  const getGapSeverityBadge = (shortage: number) => {
    if (shortage >= 5) return 'bg-red-600 text-white'
    if (shortage >= 3) return 'bg-orange-500 text-white'
    return 'bg-yellow-500 text-white'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading forecast data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workforce Forecast & Gap Analysis</h1>
          <p className="text-gray-600 mt-1">Identify staffing gaps and plan for future workforce needs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Absence Rate Simulation: {absenceRate}%
              <span className="text-xs text-gray-500 ml-2">(Simulate staff being unavailable)</span>
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={absenceRate}
              onChange={(e) => setAbsenceRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {gapAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uncovered Shifts</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{gapAnalysis.total_uncovered_shifts}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Staff Shortage</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{gapAnalysis.total_headcount_shortage}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Coverage Rate</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{trends?.coverage_rate || 0}%</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Shifts</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{gapAnalysis.total_shifts_analyzed}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skill Demand Chart */}
      {gapAnalysis && Object.keys(gapAnalysis.skill_demand).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Skills in Demand
          </h2>
          <div className="space-y-3">
            {Object.entries(gapAnalysis.skill_demand)
              .sort(([, a], [, b]) => b - a)
              .map(([skill, count]) => {
                const maxCount = Math.max(...Object.values(gapAnalysis.skill_demand))
                const percentage = (count / maxCount) * 100
                return (
                  <div key={skill} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{skill}</span>
                      <span className="text-sm font-bold text-purple-600">{count} needed</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Daily Demand Calendar View */}
      {trends && trends.daily_demand.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Daily Workforce Demand Calendar
          </h2>

          {/* Calendar Grid */}
          <div className="space-y-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                // Create a map of dates to demand data
                const demandMap = new Map(
                  trends.daily_demand.map(day => [day.date, day])
                )

                // Get all days in the range
                const days = eachDayOfInterval({
                  start: new Date(startDate),
                  end: new Date(endDate)
                })

                // Add padding days at start to align with day of week
                const firstDay = days[0]
                const startPadding = getDay(firstDay)
                const paddedDays = [
                  ...Array(startPadding).fill(null),
                  ...days
                ]

                return paddedDays.map((date, index) => {
                  if (!date) {
                    // Empty cell for padding
                    return <div key={`empty-${index}`} className="aspect-square" />
                  }

                  const dateStr = format(date, 'yyyy-MM-dd')
                  const demand = demandMap.get(dateStr)

                  if (!demand) {
                    // No data for this date
                    return (
                      <div key={dateStr} className="aspect-square border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <div className="text-sm font-medium text-gray-400">
                          {format(date, 'd')}
                        </div>
                      </div>
                    )
                  }

                  const coveragePercent = demand.required > 0 ? (demand.assigned / demand.required) * 100 : 0
                  const hasGap = demand.gap > 0

                  // Color coding based on coverage
                  let bgColor = 'bg-green-100 border-green-300'
                  let textColor = 'text-green-900'
                  if (hasGap) {
                    if (coveragePercent < 50) {
                      bgColor = 'bg-red-100 border-red-300'
                      textColor = 'text-red-900'
                    } else if (coveragePercent < 80) {
                      bgColor = 'bg-orange-100 border-orange-300'
                      textColor = 'text-orange-900'
                    } else {
                      bgColor = 'bg-yellow-100 border-yellow-300'
                      textColor = 'text-yellow-900'
                    }
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`aspect-square border-2 rounded-lg p-2 ${bgColor} hover:shadow-lg transition-all duration-200 cursor-pointer group relative`}
                      title={`${format(date, 'MMM dd, yyyy')}\nRequired: ${demand.required}\nAssigned: ${demand.assigned}\nGap: ${demand.gap}\nCoverage: ${Math.round(coveragePercent)}%`}
                    >
                      <div className={`text-sm font-bold ${textColor}`}>
                        {format(date, 'd')}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="text-xs font-medium text-gray-700">
                          {demand.required} needed
                        </div>
                        <div className={`text-xs font-bold ${hasGap ? 'text-red-600' : 'text-green-600'}`}>
                          {demand.assigned} assigned
                        </div>
                        {hasGap && (
                          <div className="text-xs font-bold text-red-600">
                            -{demand.gap} gap
                          </div>
                        )}
                      </div>

                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl whitespace-nowrap">
                          <div className="font-bold mb-1">{format(date, 'EEEE, MMM dd, yyyy')}</div>
                          <div className="space-y-1">
                            <div>Required: <span className="font-bold">{demand.required}</span></div>
                            <div>Assigned: <span className="font-bold text-green-400">{demand.assigned}</span></div>
                            {hasGap && <div>Gap: <span className="font-bold text-red-400">{demand.gap}</span></div>}
                            <div>Coverage: <span className="font-bold">{Math.round(coveragePercent)}%</span></div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-8 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
                <span className="text-sm text-gray-700">Fully Staffed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
                <span className="text-sm text-gray-700">80-99% Covered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded"></div>
                <span className="text-sm text-gray-700">50-79% Covered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                <span className="text-sm text-gray-700">&lt;50% Covered</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gap Details Table */}
      {gapAnalysis && gapAnalysis.gaps.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Staffing Gaps - Action Required
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Shifts with insufficient staffing. Hire or reassign employees with these skills.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required Skill
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staffing
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shortage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {gapAnalysis.gaps.map((gap) => (
                  <tr key={gap.shift_id} className={`hover:bg-gray-50 ${getGapSeverityColor(gap.shortage)}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {format(new Date(gap.date), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(gap.start_time), 'HH:mm')} - {format(new Date(gap.end_time), 'HH:mm')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{gap.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{gap.department}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {gap.required_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm">
                        <span className="font-bold text-gray-900">{gap.current_assigned}</span>
                        <span className="text-gray-500"> / {gap.headcount_needed}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getGapSeverityBadge(gap.shortage)}`}>
                        -{gap.shortage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-green-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold text-green-900 mb-2">All Shifts Fully Staffed!</h3>
          <p className="text-green-700">
            No staffing gaps found for the selected date range{absenceRate > 0 && ` (with ${absenceRate}% absence rate)`}.
          </p>
        </div>
      )}

      {/* Role Distribution */}
      {trends && Object.keys(trends.role_distribution).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            Role Distribution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(trends.role_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => (
                <div key={role} className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-indigo-600">{count}</div>
                  <div className="text-sm text-gray-700 mt-1">{role}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
